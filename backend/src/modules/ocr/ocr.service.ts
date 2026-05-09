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
import PDFDocument from 'pdfkit';
import AdmZip from 'adm-zip';
import {
  createImagePdfPreview,
  getImagePreviewPdfFilename,
} from '../documents/pdf-preview.service';

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
        const slideText = textMatches.map(m => m.replace(/<\/?a:t>/g, '')).join(' ');
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

const extractTextFromOffice = async (filePath: string, mimeType: string): Promise<string> => {
  if (isWordDocx(mimeType)) {
    return extractTextFromWord(filePath);
  }

  try {
    const text = await new Promise<string>((resolve, reject) => {
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
    
    if (text && text.trim().length > 0) {
      logger.info(`Office text extracted: ${text.length} characters from ${path.basename(filePath)}`);
      return text;
    }
    
    throw new Error('Empty text extracted by OfficeParser');
  } catch (error: any) {
    logger.warn(`OfficeParser failed for ${filePath}, attempting fallback extraction...`);
    
    // Fallback for PPTX if officeparser fails
    if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return extractTextFromPptxFallback(filePath);
    }
    
    return '';
  }
};

const convertTextToPdfPreview = async (text: string, outputFilename: string, title: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const outputPath = path.resolve(process.cwd(), env.UPLOAD_DIR, outputFilename);
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(outputPath);
      
      doc.pipe(stream);
      
      // Header
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).fillColor('gray').text('Document généré par DocIntel AI', { align: 'center' });
      doc.moveDown(2);
      
      // Content
      doc.fontSize(11).fillColor('black').text(text, {
        align: 'left',
        lineGap: 5
      });
      
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

  const filePath = path.resolve(process.cwd(), env.UPLOAD_DIR, doc.filename);

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
        await convertTextToPdfPreview(text, previewPdfFilename, doc.originalName);
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
