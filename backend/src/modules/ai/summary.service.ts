import { DocumentModel } from '../documents/document.model';
import { DocumentChunkModel } from '../embeddings/chunk.model';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { chunkArray } from '../../utils/helpers';
import { chatCompletionWithRetry } from '../../utils/llm';

const MAX_CONTEXT_CHARS = 12000;

// ── Summarization ─────────────────────────────────────────────────────────────

const summarizeChunk = async (text: string, isFinal = false): Promise<any> => {
  const prompt = isFinal
    ? 'Summarize the document accurately. RETURN ONLY A JSON OBJECT. NO MARKDOWN, NO PREAMBLE. JSON fields: "short", "detailed", "keyPoints". Language must match content. Format: {"short": "...", "detailed": "...", "keyPoints": ["...", "..."]}'
    : 'Summarize the following document excerpt concisely and accurately in the same language as the text.';

  const response = await chatCompletionWithRetry({
    messages: [
      { role: 'system', content: `You are a document analysis assistant. ${prompt}` },
      { role: 'user', content: text },
    ],
    temperature: 0.1,
    max_tokens: isFinal ? 1000 : 500,
    response_format: isFinal ? { type: 'json_object' } : undefined,
  });

  if (isFinal) {
    const parsed = safeJsonParse(response);
    if (parsed) return parsed;
    return { short: response.slice(0, 150), detailed: response, keyPoints: [] };
  }
  return response;
};

const safeJsonParse = (text: string): any => {
  try {
    // 1. Clean markdown code blocks if present
    let cleaned = text.replace(/```json\s?|```/g, '').trim();
    
    // 2. Attempt direct parse
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // 3. Extract JSON from between first { and last }
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    }
    return null;
  } catch (e) {
    logger.error('Total failure in safeJsonParse:', e);
    return null;
  }
};

const combineSummaries = async (summaries: string[]): Promise<{ short: string; detailed: string; keyPoints: string[] }> => {
  const combined = summaries.join('\n\n---\n\n');
  const response = await chatCompletionWithRetry({
    messages: [
      {
        role: 'system',
        content:
          'You are a document analysis assistant. Create a structured JSON response in the same language as the content. RETURN ONLY THE JSON OBJECT. NO PREAMBLE, NO CHAT, NO MARKDOWN CODE BLOCKS. The JSON must contain: "short" (1-2 sentences), "detailed" (comprehensive summary), and "keyPoints" (array of 5-8 strings). Format: {"short": "...", "detailed": "...", "keyPoints": ["...", "..."]}',
      },
      { role: 'user', content: combined },
    ],
    temperature: 0.1,
    max_tokens: 1000,
    response_format: { type: 'json_object' }
  });

  const parsed = safeJsonParse(response);
  if (parsed) return parsed;

  logger.error('Failed to parse summary JSON after extraction:', response);
  return { 
    short: response.slice(0, 150).replace(/\{|\}|"|short:|detailed:|keyPoints:/g, ''), 
    detailed: response.replace(/\{|\}|"|short:|detailed:|keyPoints:/g, ''), 
    keyPoints: [] 
  };
};

export const generateSummary = async (documentId: string, ownerId: string): Promise<any> => {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  if (!doc.extractedText || doc.extractedText.trim().length === 0) {
    throw new Error('Document has no extracted text. Run OCR first.');
  }

  const text = doc.extractedText;

  let result: { short: string; detailed: string; keyPoints: string[] };

  if (text.length <= MAX_CONTEXT_CHARS) {
    logger.info(`Summarizing document ${documentId} in single pass`);
    result = await summarizeChunk(text, true);
  } else {
    logger.info(`Summarizing document ${documentId} using map-reduce`);
    const segments: string[] = [];
    for (let i = 0; i < text.length; i += MAX_CONTEXT_CHARS) {
      segments.push(text.substring(i, i + MAX_CONTEXT_CHARS));
    }

    const partialSummaries: string[] = [];
    for (const seg of segments) {
      const s = await summarizeChunk(seg);
      partialSummaries.push(s);
    }

    result = await combineSummaries(partialSummaries);
  }

  // Persist
  await DocumentModel.findByIdAndUpdate(documentId, {
    summary: result.detailed,
    summaryShort: result.short,
    summaryDetailed: result.detailed,
    summaryBullets: result.keyPoints,
  });
  
  logger.info(`Summary fields saved for document ${documentId}`);

  return result;
};
