import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { DocumentModel } from '../documents/document.model';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { NotFoundError } from '../../utils/errors';
import {
  createImagePdfPreview,
  getImagePreviewPdfFilename,
} from '../documents/pdf-preview.service';

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
