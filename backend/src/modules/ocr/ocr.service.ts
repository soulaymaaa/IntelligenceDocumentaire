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
        .map(row => row.join(' | '));

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
  
  for (const cellXml of cellBlocks) {
    const text = extractXlsxCellText(cellXml, sharedStrings);
    const rMatch = /\br="([A-Z]+)\d+"/.exec(cellXml);
    if (rMatch) {
      const colIndex = colLetterToIndex(rMatch[1]);
      row[colIndex] = text || '';
    } else {
      row.push(text || '');
    }
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
              const maxCols = Math.max(...rows.map(r => r.length));
              const headers = rows[0].map(h => String(h || ' '));
              while (headers.length < maxCols) headers.push(' ');
              
              const tableRows = rows.slice(1).map(row => {
                const paddedRow = row.map(c => String(c || ' '));
                while (paddedRow.length < maxCols) paddedRow.push(' ');
                return paddedRow;
              });
              
              const table = {
                title: sheetTitle,
                headers: headers,
                rows: tableRows.length > 0 ? tableRows : [[' ']],
              };
              
              await doc.table(table, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
                prepareRow: () => doc.font("Helvetica").fontSize(10),
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

export const performOcr = async (documentId: string): Promise<string> => {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new NotFoundError('Document');

  const normalized = await normalizeDocumentStoredFile(doc);
  const filePath = normalized.filePath;

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  logger.info(`Starting OCR for: ${doc.originalName} (${doc.mimeType})`);


  if (doc.mimeType === 'application/pdf') {
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
  }
};

const extractTextFromPdf = async (filePath: string, documentId: string): Promise<string> => {
  const buffer = fs.readFileSync(filePath);

  // First try native PDF text extraction (fast)
  const pdfData = await pdfParse(buffer);
  const nativeText = pdfData.text?.trim() || '';

  // Update page count
  await DocumentModel.findByIdAndUpdate(documentId, {
    pageCount: pdfData.numpages,
  });

  // If native text is substantial, use it
  if (nativeText.length > 100) {
    logger.info(`PDF native text extracted: ${nativeText.length} characters, ${pdfData.numpages} pages`);
    return nativeText;
  }

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
