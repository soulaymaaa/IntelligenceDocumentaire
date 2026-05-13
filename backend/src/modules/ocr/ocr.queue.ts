import { logger } from '../../utils/logger';
import { performOcr } from './ocr.service';
import { indexDocument } from '../embeddings/embedding.service';
import { updateDocumentStatus } from '../documents/document.service';

interface Job {
  documentId: string;
  attempt: number;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;
const MAX_CONCURRENT = 2;

const queue: Job[] = [];
let activeWorkers = 0;

// ── Public API ─────────────────────────────────────────────────────────────────

export const scheduleOcr = async (documentId: string): Promise<void> => {
  // Remove any existing jobs for this document (avoid duplicates)
  const existingIdx = queue.findIndex((j) => j.documentId === documentId);
  if (existingIdx !== -1) queue.splice(existingIdx, 1);

  await updateDocumentStatus(documentId, 'pending');
  queue.push({ documentId, attempt: 1 });
  logger.info(`OCR queued: ${documentId} (queue length: ${queue.length})`);

  drainQueue();
};

// ── Worker pool ────────────────────────────────────────────────────────────────

const drainQueue = (): void => {
  while (activeWorkers < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    activeWorkers++;
    processJob(job).finally(() => {
      activeWorkers--;
      drainQueue(); // pick up next job when a worker slot frees
    });
  }
};

const processJob = async (job: Job): Promise<void> => {
  const { documentId, attempt } = job;
  logger.info(`OCR processing: ${documentId} (attempt ${attempt}/${MAX_RETRIES + 1})`);

  try {
    await updateDocumentStatus(documentId, 'processing_ocr');

    const extractedText = await performOcr(documentId);

    if (!extractedText || extractedText.trim().length === 0) {
      await updateDocumentStatus(documentId, 'error', {
        errorMessage: 'No text could be extracted from this document. The file may be blank or in an unsupported format.',
      } as any);
      logger.warn(`OCR produced no text for ${documentId}`);
      return;
    }

    // Index embeddings
    await indexDocument(documentId, extractedText);
    await updateDocumentStatus(documentId, 'indexed', { extractedText } as any);
    logger.info(`Document indexed: ${documentId} (${extractedText.length} chars)`);

  } catch (error: any) {
    const message: string = error?.message ?? 'OCR processing failed';
    logger.error(`OCR failed for ${documentId} (attempt ${attempt}): ${message}`);

    if (attempt <= MAX_RETRIES) {
      // Re-queue with incremented attempt counter after a delay
      logger.info(`Retrying ${documentId} in ${RETRY_DELAY_MS / 1000}s (attempt ${attempt + 1})`);
      await updateDocumentStatus(documentId, 'pending', {
        errorMessage: `Attempt ${attempt} failed: ${message} — retrying…`,
      } as any);

      setTimeout(() => {
        queue.push({ documentId, attempt: attempt + 1 });
        drainQueue();
      }, RETRY_DELAY_MS);
    } else {
      // All retries exhausted
      await updateDocumentStatus(documentId, 'error', { errorMessage: message } as any);
      logger.error(`OCR permanently failed for ${documentId} after ${attempt} attempt(s): ${message}`);
    }
  }
};
