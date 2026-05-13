import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { DocumentModel } from '../documents/document.model';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { NotFoundError } from '../../utils/errors';
const officeparser = require('officeparser');
import mammoth from 'mammoth';
import PDFDocument from 'pdfkit-table';
import AdmZip from 'adm-zip';
import {
  createImagePdfPreview,
  getImagePreviewPdfFilename,
} from '../documents/pdf-preview.service';
import { normalizeDocumentStoredFile } from '../documents/document-file.service';

const OFFICE_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
];

const isOfficeType = (mimeType: string) => OFFICE_MIME_TYPES.includes(mimeType);
const isWordDocx = (mimeType: string) => mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const isSpreadsheetXlsx = (mimeType: string) => mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const isPowerPointPptx = (mimeType: string) => mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const isTextType = (mimeType: string) => mimeType === 'text/plain';

const extractTextFromWord = async (filePath: string): Promise<string> => {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    logger.info(`Mammoth extracted ${result.value.length} chars from ${path.basename(filePath)}`);
    return result.value;
  } catch (error) {
    logger.error(`Mammoth extraction failed for ${filePath}:`, error);
    throw error;
  }
};

const extractTextFromPptxFallback = (filePath: string): string => {
  try {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();
    let fullText = '';

    // PPTX stores text in ppt/slides/slideN.xml
    const slideEntries = zipEntries
      .filter(entry => entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml'))
      .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));

    for (const entry of slideEntries) {
      const content = entry.getData().toString('utf8');
      // Simple regex to extract text content between <a:t> tags
      const textMatches = content.match(/<a:t>([^<]+)<\/a:t>/g);
      if (textMatches) {
        const slideText = textMatches
          .map(m => decodeXmlText(m.replace(/<\/?a:t>/g, '')))
          .join(' ');
        fullText += slideText + '\n\n';
      }
    }

    if (fullText.trim().length > 0) {
      logger.info(`Fallback PPTX extraction successful: ${fullText.length} characters`);
      return fullText.trim();
    }
    return '';
  } catch (error) {
    logger.error(`Fallback PPTX extraction failed for ${filePath}:`, error);
    return '';
  }
};

const extractTextFromXlsxFallback = (filePath: string): string => {
  try {
    const zip = new AdmZip(filePath);
    const sharedStrings = readXlsxSharedStrings(zip);
    const sheetNames = readXlsxSheetNames(zip);
    const sheetEntries = zip.getEntries()
      .filter(entry => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.entryName))
      .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true }));

    const sheets = sheetEntries.map((entry, index) => {
      const sheetName = sheetNames[index] || `Sheet ${index + 1}`;
      const content = entry.getData().toString('utf8');
      const rows = extractXmlBlocks(content, 'row')
        .map(rowXml => extractXlsxRowText(rowXml, sharedStrings))
        .filter(row => row.length > 0)
        .map(row => row.map(cell => cell.replace(/[\r\n]+/g, '\\n').replace(/_x000D_|Ð/g, '').trim()).join(' | '));

      return rows.length > 0 ? `${sheetName}\n${rows.join('\n')}` : '';
    }).filter(Boolean);

    const fullText = sheets.join('\n\n');
    if (fullText.trim().length > 0) {
      logger.info(`Fallback XLSX extraction successful: ${fullText.length} characters`);
      return fullText.trim();
    }
  } catch (error) {
    logger.error(`Fallback XLSX extraction failed for ${filePath}:`, error);
  }

  return '';
};

const readXlsxSharedStrings = (zip: AdmZip): string[] => {
  const entry = zip.getEntry('xl/sharedStrings.xml');
  if (!entry) return [];

  return extractXmlBlocks(entry.getData().toString('utf8'), 'si')
    .map(siXml => extractXmlBlocks(siXml, 't').map(decodeXmlText).join(''))
    .map(text => text.trim());
};

const readXlsxSheetNames = (zip: AdmZip): string[] => {
  const entry = zip.getEntry('xl/workbook.xml');
  if (!entry) return [];

  const workbookXml = entry.getData().toString('utf8');
  const names: string[] = [];
  const sheetRegex = /<sheet\b[^>]*\bname="([^"]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = sheetRegex.exec(workbookXml)) !== null) {
    names.push(decodeXmlText(match[1]));
  }

  return names;
};

const colLetterToIndex = (letters: string): number => {
  let index = 0;
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + letters.charCodeAt(i) - 64;
  }
  return index - 1;
};

const extractXlsxRowText = (rowXml: string, sharedStrings: string[]): string[] => {
  const cellBlocks = extractXlsxCellBlocks(rowXml);
  const row: string[] = [];
  let currentColIndex = 0;
  
  for (const cellXml of cellBlocks) {
    const text = extractXlsxCellText(cellXml, sharedStrings);
    const rMatch = /\br=['"]?([A-Z]+)\d+['"]?/i.exec(cellXml);
    if (rMatch) {
      currentColIndex = colLetterToIndex(rMatch[1].toUpperCase());
    }
    row[currentColIndex] = text || '';
    currentColIndex++;
  }
  
  for (let i = 0; i < row.length; i++) {
    if (row[i] === undefined) row[i] = '';
  }
  
  return row;
};

const extractXlsxCellBlocks = (rowXml: string): string[] => {
  const cellRegex = /<c\b[^>]*>[\s\S]*?<\/c>/g;
  return rowXml.match(cellRegex) || [];
};

const extractXlsxCellText = (cellXml: string, sharedStrings: string[]): string | undefined => {
  const type = /\bt="([^"]+)"/.exec(cellXml)?.[1];
  const rawValue = extractXmlBlocks(cellXml, 'v')[0];

  if (type === 's' && rawValue !== undefined) {
    return sharedStrings[Number(rawValue)] || undefined;
  }

  if (type === 'inlineStr') {
    const inlineText = extractXmlBlocks(cellXml, 't').map(decodeXmlText).join('');
    return inlineText.trim() || undefined;
  }

  if (rawValue !== undefined) {
    const decoded = decodeXmlText(rawValue).trim();
    return decoded || undefined;
  }

  return undefined;
};

const extractXmlBlocks = (xml: string, tagName: string): string[] => {
  const regex = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'g');
  const blocks: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    blocks.push(match[1]);
  }

  return blocks;
};

const decodeXmlText = (value: string): string => {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

const coerceOfficeParserText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const parts: string[] = [];
  collectOfficeParserText(value, parts);
  return parts.join('\n').trim();
};

const collectOfficeParserText = (node: unknown, parts: string[]): void => {
  if (!node || typeof node !== 'object') return;

  const candidate = node as { text?: unknown; children?: unknown };
  if (typeof candidate.text === 'string' && candidate.text.trim()) {
    parts.push(candidate.text.trim());
  }

  if (Array.isArray(candidate.children)) {
    candidate.children.forEach(child => collectOfficeParserText(child, parts));
  }
};

export const extractTextFromOffice = async (filePath: string, mimeType: string): Promise<string> => {
  if (isWordDocx(mimeType)) {
    return extractTextFromWord(filePath);
  }

  if (isSpreadsheetXlsx(mimeType)) {
    return extractTextFromXlsxFallback(filePath);
  }

  try {
    const parsed = await new Promise<unknown>((resolve, reject) => {
      try {
        officeparser.parseOffice(filePath, (data: any, err: any) => {
          if (err) {
            logger.error(`OfficeParser callback error for ${filePath}:`, err);
            return reject(err);
          }
          resolve(data);
        });
      } catch (parseErr) {
        logger.error(`OfficeParser synchronous error for ${filePath}:`, parseErr);
        reject(parseErr);
      }
    });
    const text = coerceOfficeParserText(parsed);
    
    if (text && text.trim().length > 0) {
      logger.info(`Office text extracted: ${text.length} characters from ${path.basename(filePath)}`);
      return text;
    }
    
    throw new Error('Empty text extracted by OfficeParser');
  } catch (error: any) {
    logger.warn(`OfficeParser failed for ${filePath}, attempting fallback extraction...`);
    
    if (isPowerPointPptx(mimeType)) {
      return extractTextFromPptxFallback(filePath);
    }

    if (isSpreadsheetXlsx(mimeType)) {
      return extractTextFromXlsxFallback(filePath);
    }
    
    return '';
  }
};

const convertTextToPdfPreview = async (text: string, outputFilename: string, title: string, mimeType?: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const outputPath = path.resolve(process.cwd(), env.UPLOAD_DIR, outputFilename);
      const isExcel = mimeType && isSpreadsheetXlsx(mimeType);
      const doc = new PDFDocument({ 
        margin: isExcel ? 30 : 50, 
        size: 'A4',
        layout: isExcel ? 'landscape' : 'portrait' 
      });
      const stream = fs.createWriteStream(outputPath);
      
      doc.pipe(stream);
      
      // Header
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).fillColor('gray').text('Document genere par DocIntel AI', { align: 'center' });
      doc.moveDown(2);
      
      if (mimeType && isSpreadsheetXlsx(mimeType)) {
        const sheets = text.split('\n\n');
        for (const sheet of sheets) {
          const lines = sheet.split('\n');
          if (lines.length > 0) {
            const sheetTitle = lines[0];
            const rows = lines.slice(1).map(line => line.split(' | '));
            
            if (rows.length > 0) {
              let headerRow = rows[0];
              while(headerRow.length > 0 && !headerRow[headerRow.length - 1].trim()) {
                 headerRow.pop();
              }
              const maxCols = headerRow.length;
              const headers = headerRow.map(h => String(h || ' '));
              
              const tableRows = rows.slice(1).map(row => {
                const paddedRow = row.slice(0, maxCols).map(c => String(c || ' '));
                while (paddedRow.length < maxCols) paddedRow.push(' ');
                return paddedRow;
              });
              
              const colMaxLengths = headers.map((h, i) => {
                let max = h.length;
                for (const row of tableRows) {
                  if (row[i]) {
                    const lines = row[i].replace(/\\n/g, '\n').split('\n');
                    for (const line of lines) {
                      if (line.length > max) {
                        max = line.length;
                      }
                    }
                  }
                }
                return Math.max(15, Math.min(max, 150));
              });
              
              const totalLength = colMaxLengths.reduce((a, b) => a + b, 0) || 1;
              const usableWidth = 841.89 - 60;
              
              const headersWithWidths = headers.map((h, i) => {
                const width = (colMaxLengths[i] / totalLength) * usableWidth;
                return { label: h, width };
              });

              const finalRows: string[][] = [];
              for (const row of tableRows) {
                const unescapedRow = row.map(cell => cell.replace(/\\n/g, '\n'));
                const splitCells = unescapedRow.map(cell => cell.split('\n'));
                const maxLines = Math.max(...splitCells.map(c => c.length));
                
                for (let i = 0; i < maxLines; i++) {
                  const subRow = splitCells.map(cellLines => cellLines[i] || ' ');
                  finalRows.push(subRow);
                }
                finalRows.push(headers.map(() => ' '));
              }

              if (finalRows.length > 0 && finalRows[finalRows.length - 1].every(c => c === ' ')) {
                finalRows.pop();
              }

              const table = {
                title: sheetTitle,
                headers: headersWithWidths,
                rows: finalRows.length > 0 ? finalRows : [[' ']],
              };
              
              doc.fontSize(8); // Crucial to prevent pdfkit-table pagination bug
              await doc.table(table, {
                width: usableWidth,
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
                prepareRow: () => doc.font("Helvetica").fontSize(8),
                divider: {
                  header: { disabled: false, width: 1, opacity: 1 },
                  horizontal: { disabled: true, width: 0, opacity: 0 },
                }
              });
              doc.moveDown(2);
            } else {
              doc.fontSize(12).font("Helvetica-Bold").text(sheetTitle);
              doc.moveDown();
            }
          }
        }
      } else {
        // Content
        doc.fontSize(11).fillColor('black').text(text, {
          align: 'left',
          lineGap: 5
        });
      }
      
      doc.end();
      
      stream.on('finish', () => {
        logger.info(`PDF preview generated: ${outputFilename}`);
        resolve();
      });
      stream.on('error', (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
};

// ── Lazy-loaded PDF renderer (pdfjs-dist is ESM-only, loaded via dynamic import) ──

interface PdfRenderer {
  pdfjsLib: any;
  createCanvas: (w: number, h: number) => any;
}

let _renderer: PdfRenderer | null = null;
let _rendererLoading: Promise<PdfRenderer | null> | null = null;

// Use Function constructor to prevent TypeScript from compiling import() → require()
// This is the standard pattern for loading ESM modules from CJS TypeScript output.
const esmImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;

const getPdfRenderer = async (): Promise<PdfRenderer | null> => {
  if (_renderer) return _renderer;
  if (_rendererLoading) return _rendererLoading;

  _rendererLoading = (async () => {
    try {
      const pdfjsLib = await esmImport('pdfjs-dist/legacy/build/pdf.mjs');
      // Disable Web Worker — use fake worker for Node.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';

      // @napi-rs/canvas is a CJS module — direct require is fine
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createCanvas } = require('@napi-rs/canvas');

      _renderer = { pdfjsLib, createCanvas };
      logger.info('PDF renderer ready (pdfjs-dist v5 + @napi-rs/canvas)');
      return _renderer;
    } catch (err: any) {
      logger.error('PDF renderer failed to initialize — scanned PDFs will not be OCR\'d', {
        error: err.message,
      });
      return null;
    }
  })();

  return _rendererLoading;
};

// ── Public API ─────────────────────────────────────────────────────────────────

export const performOcr = async (documentId: string): Promise<string> => {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new NotFoundError('Document');

  const normalized = await normalizeDocumentStoredFile(doc);
  const filePath = normalized.filePath;

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  logger.info(`OCR start: "${doc.originalName}" (${doc.mimeType}, ${(doc.size / 1024).toFixed(1)} KB)`);

  let raw: string;


  if (doc.mimeType === 'application/pdf') {
<<<<<<< HEAD
    return extractTextFromPdf(filePath, documentId);
  } else if (isOfficeType(doc.mimeType)) {
    const text = await extractTextFromOffice(filePath, doc.mimeType);
    
    // Generate a PDF preview so the user can see the content in the viewer
    if (text && text.trim().length > 0) {
      const previewPdfFilename = `preview_${path.parse(doc.filename).name}.pdf`;
      try {
        await convertTextToPdfPreview(text, previewPdfFilename, doc.originalName || doc.filename, doc.mimeType);
        await DocumentModel.findByIdAndUpdate(documentId, { ocrPdfPath: previewPdfFilename });
        logger.info(`Office document converted to PDF preview: ${previewPdfFilename}`);
      } catch (err) {
        logger.warn(`Failed to generate PDF preview for Office file: ${err}`);
      }
    }
    
    return text;
  } else if (isTextType(doc.mimeType)) {
    return fs.readFileSync(filePath, 'utf-8');
  } else {
    logger.info(`Image detected - preparing PDF preview and OCR for: ${doc.originalName}`);
    await ensureImagePdfPreview(filePath, documentId, doc.filename, doc.ocrPdfPath);
    
    // Pre-process image for better OCR using the same "Magic Color" logic
    const enhancedFilename = `enhanced_${doc.filename}`;
    const enhancedPath = path.resolve(process.cwd(), env.UPLOAD_DIR, enhancedFilename);
    
    // Using a simpler version of the Magic Color pipeline for OCR optimization
    await sharp(filePath)
      .rotate()
      .grayscale()
      .normalize()
      .linear(1.5, -0.15) // High contrast for Tesseract
      .sharpen({ sigma: 1.5 })
      .toFile(enhancedPath);

    try {
      const { text } = await ocrWithTesseract(enhancedPath);
      return text;
    } finally {
      deleteTempFile(enhancedPath);
    }
  }
};

const ensureImagePdfPreview = async (
  filePath: string,
  documentId: string,
  filename: string,
  existingPdfPath?: string
): Promise<void> => {
  const previewPdfFilename = getImagePreviewPdfFilename(filename);
  const previewPdfPath = path.resolve(process.cwd(), env.UPLOAD_DIR, previewPdfFilename);

  try {
    await createImagePdfPreview(filePath, previewPdfPath);
    await DocumentModel.findByIdAndUpdate(documentId, {
      ocrPdfPath: previewPdfFilename,
      pageCount: 1,
    });
    logger.info(`Image PDF preview generated and saved: ${previewPdfFilename}`);
  } catch (error) {
    logger.warn(`Image PDF preview generation failed for ${filename}:`, error);
  }
};

const deleteTempFile = (filePath: string): void => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Temporary files should not block OCR completion.
=======
    raw = await extractFromPdf(filePath, documentId);
  } else {
    raw = await extractFromImage(filePath);
>>>>>>> 8cc1307b0c4b1c4690e57af12a159aa6776fc8cd
  }

  const cleaned = cleanText(raw);
  logger.info(`OCR done: ${cleaned.length} chars, ~${wordCount(cleaned)} words`);
  return cleaned;
};

// ── PDF extraction ─────────────────────────────────────────────────────────────

const extractFromPdf = async (filePath: string, documentId: string): Promise<string> => {
  const buffer = fs.readFileSync(filePath);

  // Step 1: attempt native text extraction (fast, high quality)
  let pdfData: any = null;
  try {
    pdfData = await pdfParse(buffer);
  } catch (err: any) {
    logger.warn(`pdf-parse failed: ${err.message} — will attempt image OCR`);
  }

  const nativeText = pdfData?.text?.trim() ?? '';
  const numPages = pdfData?.numpages ?? 0;

  if (numPages > 0) {
    await DocumentModel.findByIdAndUpdate(documentId, { pageCount: numPages });
  }

  const wCount = wordCount(nativeText);
  const isSubstantial = wCount >= 30;

  if (isSubstantial) {
    logger.info(`Native PDF text: ${nativeText.length} chars / ${wCount} words / ${numPages} pages`);
    return nativeText;
  }

<<<<<<< HEAD
  // Otherwise, OCR the PDF as image (scanned PDFs)
  logger.info('PDF appears to be scanned — falling back to Tesseract OCR');
  const { text, pdfBuffer } = await ocrWithTesseract(filePath, true);
  
  if (pdfBuffer) {
    const ocrPdfFilename = `ocr_${path.basename(filePath)}`;
    const ocrPdfPath = path.resolve(process.cwd(), env.UPLOAD_DIR, ocrPdfFilename);
    fs.writeFileSync(ocrPdfPath, Buffer.from(pdfBuffer));
    await DocumentModel.findByIdAndUpdate(documentId, { ocrPdfPath: ocrPdfFilename });
  }

  return text;
};

const ocrWithTesseract = async (filePath: string, generatePdf = false): Promise<{ text: string; pdfBuffer?: Uint8Array }> => {
  const worker = await Tesseract.createWorker(env.OCR_LANGUAGES);
  
  try {
    const recognizeOptions = generatePdf ? ({ pdf: true } as any) : undefined;
    const { data } = await worker.recognize(filePath, recognizeOptions);
    const text = data.text?.trim() || '';
    const pdfBuffer = generatePdf ? (data as any).pdf : undefined;
    
    logger.info(`Tesseract OCR complete: ${text.length} characters extracted (PDF: ${!!pdfBuffer})`);
    return { text, pdfBuffer };
  } finally {
    await worker.terminate();
  }
};
=======
  // Step 2: scanned PDF — render each page as an image and OCR
  logger.info(`PDF has only ${wCount} words of native text — rendering pages for OCR`);
  const scannedText = await renderPdfPagesAndOcr(buffer);

  // Update page count from rendering if we didn't get it earlier
  if (!numPages && scannedText) {
    // page count is updated inside renderPdfPagesAndOcr
  }

  return scannedText || nativeText; // fallback to any native text if OCR also fails
};

const renderPdfPagesAndOcr = async (buffer: Buffer): Promise<string> => {
  const renderer = await getPdfRenderer();

  if (!renderer) {
    throw new Error(
      'Cannot OCR scanned PDF: PDF renderer not available. ' +
      'Ensure pdfjs-dist and @napi-rs/canvas are installed.'
    );
  }

  const { pdfjsLib, createCanvas } = renderer;

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const numPages: number = pdf.numPages;

  logger.info(`Rendering ${numPages} page(s) for OCR (scale 2×)`);

  // Provide a canvas factory so pdfjs uses @napi-rs/canvas
  const canvasFactory = {
    create: (w: number, h: number) => {
      const canvas = createCanvas(w, h);
      return { canvas, context: canvas.getContext('2d') };
    },
    reset: (cc: any, w: number, h: number) => {
      cc.canvas.width = w;
      cc.canvas.height = h;
    },
    destroy: (cc: any) => {
      cc.canvas.width = 0;
      cc.canvas.height = 0;
    },
  };

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    logger.info(`  Page ${pageNum}/${numPages}`);
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // 2× → ~150 DPI → decent OCR quality

      const { canvas, context } = canvasFactory.create(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );

      await page.render({ canvasContext: context, viewport, canvasFactory }).promise;

      // Convert canvas to PNG buffer
      const pngBuffer: Buffer = canvas.toBuffer('image/png');

      // Preprocess for better Tesseract accuracy
      const processed = await preprocessImageBuffer(pngBuffer);

      const text = await ocrBuffer(processed);
      if (text.trim()) pageTexts.push(text.trim());

      // Free memory
      canvasFactory.destroy({ canvas });
      page.cleanup();
    } catch (pageErr: any) {
      logger.warn(`  Page ${pageNum} failed: ${pageErr.message}`);
    }
  }

  const combined = pageTexts.join('\n\n');
  logger.info(`Scanned PDF OCR: ${combined.length} chars from ${numPages} page(s)`);
  return combined;
};

// ── Image extraction ───────────────────────────────────────────────────────────

const extractFromImage = async (filePath: string): Promise<string> => {
  logger.info('Preprocessing image with sharp before OCR');
  let processed: Buffer;

  try {
    processed = await preprocessImageFile(filePath);
  } catch (err: any) {
    logger.warn(`sharp preprocessing failed (${err.message}), using raw file`);
    processed = fs.readFileSync(filePath);
  }

  return ocrBuffer(processed);
};

// ── Image preprocessing ────────────────────────────────────────────────────────

/**
 * Preprocess a file-based image for better OCR accuracy:
 * 1. Upscale to at least 2400px wide (OCR needs resolution)
 * 2. Greyscale (reduces noise)
 * 3. Sharpen text edges
 * 4. Normalise contrast
 */
const preprocessImageFile = async (filePath: string): Promise<Buffer> => {
  const meta = await sharp(filePath).metadata();
  const width = meta.width ?? 0;

  return sharp(filePath)
    .resize(
      width < 2000 ? { width: 2400, withoutEnlargement: false } : undefined
    )
    .greyscale()
    .sharpen({ sigma: 1.0, m1: 0.5, m2: 3.0 })
    .normalise()
    .png()
    .toBuffer();
};

/**
 * Preprocess an in-memory PNG buffer (used for PDF pages rendered to canvas).
 */
const preprocessImageBuffer = async (pngBuffer: Buffer): Promise<Buffer> => {
  return sharp(pngBuffer)
    .greyscale()
    .sharpen({ sigma: 1.0, m1: 0.5, m2: 3.0 })
    .normalise()
    .png()
    .toBuffer();
};

// ── Tesseract OCR ──────────────────────────────────────────────────────────────

const ocrBuffer = async (input: Buffer | string): Promise<string> => {
  const result = await Tesseract.recognize(input, env.OCR_LANGUAGES, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round(m.progress * 100);
        if (pct % 25 === 0) logger.debug(`  Tesseract: ${pct}%`);
      }
    },
  });

  const words = result.data.words ?? [];
  const CONFIDENCE_THRESHOLD = 35; // 0–100; words below this are noise

  // Use per-line reconstruction only when we have enough high-confidence words
  if (words.length > 0) {
    const goodWords = words.filter((w: any) => w.confidence >= CONFIDENCE_THRESHOLD);
    const ratio = goodWords.length / words.length;

    if (ratio >= 0.5 && result.data.lines && result.data.lines.length > 0) {
      const reconstructed = result.data.lines
        .map((line: any) =>
          (line.words as any[])
            .filter((w) => w.confidence >= CONFIDENCE_THRESHOLD)
            .map((w) => w.text)
            .join(' ')
        )
        .filter((l: string) => l.trim().length > 0)
        .join('\n');

      if (reconstructed.length > 0) {
        logger.debug(`Tesseract: ${goodWords.length}/${words.length} words ≥ ${CONFIDENCE_THRESHOLD}% confidence`);
        return reconstructed;
      }
    } else {
      logger.warn(`Low OCR confidence: only ${Math.round(ratio * 100)}% words above threshold`);
    }
  }

  return result.data.text?.trim() ?? '';
};

// ── Text cleaning ──────────────────────────────────────────────────────────────

/**
 * Normalise extracted text for clean embedding input:
 * - Unify line endings
 * - Rejoin words split by end-of-line hyphenation
 * - Collapse excess whitespace / blank lines
 * - Remove common OCR artefacts and control characters
 */
export const cleanText = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Fix hyphenated line breaks: "connec-\ntion" → "connection"
    .replace(/(\w)-\n(\w)/g, '$1$2')
    // Collapse multiple spaces to one
    .replace(/ {2,}/g, ' ')
    // Trim trailing spaces on each line
    .replace(/ +$/gm, '')
    // Max 2 consecutive blank lines (preserve paragraph structure)
    .replace(/\n{3,}/g, '\n\n')
    // Remove lines that are just page numbers
    .replace(/^\s*\d{1,3}\s*$/gm, '')
    // Remove null bytes and non-printable control characters (except \n and \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const wordCount = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length;
>>>>>>> 8cc1307b0c4b1c4690e57af12a159aa6776fc8cd
