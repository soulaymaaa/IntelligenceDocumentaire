import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { DocumentModel } from '../documents/document.model';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { NotFoundError } from '../../utils/errors';

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
  } else {
    return extractTextFromImage(filePath);
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
  return ocrWithTesseract(filePath);
};

const extractTextFromImage = async (filePath: string): Promise<string> => {
  return ocrWithTesseract(filePath);
};

const ocrWithTesseract = async (filePath: string): Promise<string> => {
  const result = await Tesseract.recognize(filePath, env.OCR_LANGUAGES, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
      }
    },
  });

  const text = result.data.text?.trim() || '';
  logger.info(`Tesseract OCR complete: ${text.length} characters extracted`);
  return text;
};
