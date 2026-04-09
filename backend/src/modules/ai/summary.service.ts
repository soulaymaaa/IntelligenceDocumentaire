import Groq from 'groq-sdk';
import { DocumentModel } from '../documents/document.model';
import { DocumentChunkModel } from '../embeddings/chunk.model';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { chunkArray } from '../../utils/helpers';

const SUMMARY_MODEL = 'llama-3.3-70b-versatile';
const MAX_CONTEXT_CHARS = 12000;

let groqClient: Groq | null = null;

const getGroq = (): Groq => {
  if (!groqClient) {
    if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');
    groqClient = new Groq({ apiKey: env.GROQ_API_KEY });
  }
  return groqClient;
};

// ── Summarization ─────────────────────────────────────────────────────────────

const summarizeChunk = async (groq: Groq, text: string): Promise<string> => {
  const response = await groq.chat.completions.create({
    model: SUMMARY_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a document analysis assistant. Summarize the following document excerpt concisely and accurately in the same language as the text.',
      },
      { role: 'user', content: text },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });
  return response.choices[0]?.message?.content?.trim() || '';
};

const combineSummaries = async (groq: Groq, summaries: string[]): Promise<string> => {
  const combined = summaries.join('\n\n---\n\n');
  const response = await groq.chat.completions.create({
    model: SUMMARY_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are a document analysis assistant. You have been given multiple partial summaries of a document. Create a single, coherent, comprehensive summary that captures the key points, in the same language as the content.',
      },
      { role: 'user', content: combined },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });
  return response.choices[0]?.message?.content?.trim() || '';
};

export const generateSummary = async (documentId: string, ownerId: string): Promise<string> => {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  if (!doc.extractedText || doc.extractedText.trim().length === 0) {
    throw new Error('Document has no extracted text. Run OCR first.');
  }

  const groq = getGroq();
  const text = doc.extractedText;

  let summary: string;

  if (text.length <= MAX_CONTEXT_CHARS) {
    // Single-pass summarization
    logger.info(`Summarizing document ${documentId} in single pass`);
    summary = await summarizeChunk(groq, text);
  } else {
    // Map-reduce: chunk → summarize each → combine
    logger.info(`Summarizing document ${documentId} using map-reduce`);
    const segments: string[] = [];
    for (let i = 0; i < text.length; i += MAX_CONTEXT_CHARS) {
      segments.push(text.substring(i, i + MAX_CONTEXT_CHARS));
    }

    const partialSummaries = await Promise.all(
      segments.map((seg) => summarizeChunk(groq, seg))
    );

    summary = await combineSummaries(groq, partialSummaries);
  }

  // Persist
  await DocumentModel.findByIdAndUpdate(documentId, { summary });
  logger.info(`Summary saved for document ${documentId}`);

  return summary;
};
