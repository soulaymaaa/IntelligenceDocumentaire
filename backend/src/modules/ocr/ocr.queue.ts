import { logger } from '../../utils/logger';
import { performOcr } from './ocr.service';
import { indexDocument } from '../embeddings/embedding.service';
import { updateDocumentStatus } from '../documents/document.service';

// Simple in-process queue for development
// In production: swap to BullMQ + Redis
interface Job {
  documentId: string;
}

const queue: Job[] = [];
let isProcessing = false;

export const scheduleOcr = async (documentId: string): Promise<void> => {
  await updateDocumentStatus(documentId, 'pending');
  queue.push({ documentId });
  logger.info(`OCR job queued for document: ${documentId}`);

  if (!isProcessing) {
    processQueue();
  }
};

const processQueue = async (): Promise<void> => {
  if (queue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const job = queue.shift()!;

  try {
    logger.info(`Processing OCR job for document: ${job.documentId}`);
    await updateDocumentStatus(job.documentId, 'processing_ocr');

    const extractedText = await performOcr(job.documentId);

    if (extractedText && extractedText.trim().length > 0) {
      // Index embeddings
      await indexDocument(job.documentId, extractedText);
      await updateDocumentStatus(job.documentId, 'indexed', { extractedText } as any);
      logger.info(`Document indexed successfully: ${job.documentId}`);
    } else {
      await updateDocumentStatus(job.documentId, 'error', {
        errorMessage: 'No text could be extracted from this document',
      } as any);
    }
  } catch (error: any) {
    logger.error(`OCR job failed for document ${job.documentId}:`, error);
    await updateDocumentStatus(job.documentId, 'error', {
      errorMessage: error.message || 'OCR processing failed',
    } as any);
  }

  // Process next job after a small delay
  setTimeout(() => processQueue(), 100);
};
