import { DocumentModel } from '../documents/document.model';
import { logger } from '../../utils/logger';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { chatCompletionWithRetry } from '../../utils/llm';

const MAX_CONTEXT_CHARS = 12000;

export interface SummaryPayload {
  short: string;
  detailed: string;
  keyPoints: string[];
}

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

// ── Individual summary generators ────────────────────────────────────────────

const buildShortSummary = async (text: string): Promise<string> => {
  return chatCompletionWithRetry({
    messages: [
      {
        role: 'system',
        content: `You are a document analysis expert. Write a concise executive summary of the document in 2-4 sentences.
Rules:
- Capture the main topic, purpose, and key conclusion.
- Be direct and professional.
- Do NOT use bullet points. Write as plain prose.
- Respond in the same language as the document.`,
      },
      { role: 'user', content: `Summarize this document:\n\n${text.substring(0, MAX_CONTEXT_CHARS)}` },
    ],
    temperature: 0.3,
    max_tokens: 300,
  });
};

const buildDetailedSummary = async (text: string): Promise<string> => {
  if (text.length <= MAX_CONTEXT_CHARS) {
    return chatCompletionWithRetry({
      messages: [
        {
          role: 'system',
          content: `You are a document analysis expert. Write a thorough, structured summary of the document.
Rules:
- Cover all major sections, arguments, and conclusions.
- Use clear paragraphs with logical flow.
- Be comprehensive yet readable (aim for 3-6 paragraphs).
- Do NOT list everything verbatim — synthesize and explain.
- Respond in the same language as the document.`,
        },
        { role: 'user', content: `Write a detailed summary of this document:\n\n${text}` },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });
  }

  // Map-reduce for large documents
  const segments: string[] = [];
  for (let i = 0; i < text.length; i += MAX_CONTEXT_CHARS) {
    segments.push(text.substring(i, i + MAX_CONTEXT_CHARS));
  }

  const partials: string[] = [];
  for (const seg of segments) {
    const partial = await chatCompletionWithRetry({
      messages: [
        {
          role: 'system',
          content: 'You are a document analysis assistant. Summarize the following excerpt concisely.',
        },
        { role: 'user', content: seg },
      ],
      temperature: 0.3,
      max_tokens: 600,
    });
    partials.push(partial);
  }

  return chatCompletionWithRetry({
    messages: [
      {
        role: 'system',
        content: `You are a document analysis expert. You have partial summaries of a large document.
Combine them into a single, coherent, comprehensive summary (3-6 paragraphs).
Respond in the same language as the content.`,
      },
      { role: 'user', content: partials.join('\n\n---\n\n') },
    ],
    temperature: 0.3,
    max_tokens: 1200,
  });
};

const buildKeyPoints = async (text: string): Promise<string[]> => {
  const raw = await chatCompletionWithRetry({
    messages: [
      {
        role: 'system',
        content: `You are a document analysis expert. Extract the 5-8 most important key points from this document.
Rules:
- Output ONLY a JSON array of strings, no other text.
- Each string is one key point (1-2 sentences max).
- Cover the most important facts, conclusions, and insights.
- Respond in the same language as the document.
- Format: ["Point 1", "Point 2", ...]`,
      },
      { role: 'user', content: `Extract key points from:\n\n${text.substring(0, MAX_CONTEXT_CHARS)}` },
    ],
    temperature: 0.2,
    max_tokens: 600,
  });

  try {
    // Strip markdown code block if present
    const cleaned = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === 'string')) {
      return parsed.filter((p) => p.trim().length > 0);
    }
  } catch {
    // Fallback: split by newlines/bullets
    const lines = raw
      .split(/\n+/)
      .map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim())
      .filter((l) => l.length > 10);
    if (lines.length > 0) return lines;
  }

  return [raw.trim()];
};

// ── Main export ───────────────────────────────────────────────────────────────

export const generateSummary = async (
  documentId: string,
  ownerId: string,
  mode: 'short' | 'detailed' | 'key_points' | 'all' = 'all'
): Promise<SummaryPayload> => {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  if (!doc.extractedText || doc.extractedText.trim().length === 0) {
    throw new Error('Document has no extracted text. Run OCR first.');
  }

  const text = doc.extractedText;
  logger.info(`Generating summary for document ${documentId} (mode: ${mode})`);

  const generateAll = mode === 'all';

  const [short, detailed, keyPoints] = await Promise.all([
    generateAll || mode === 'short' ? buildShortSummary(text) : Promise.resolve(doc.summaryShort || ''),
    generateAll || mode === 'detailed' ? buildDetailedSummary(text) : Promise.resolve(doc.summaryDetailed || ''),
    generateAll || mode === 'key_points' ? buildKeyPoints(text) : Promise.resolve(doc.summaryBullets || []),
  ]);

  // Persist all generated fields back to the document
  const update: Record<string, unknown> = { summary: detailed || short };
  if (generateAll || mode === 'short') update.summaryShort = short;
  if (generateAll || mode === 'detailed') update.summaryDetailed = detailed;
  if (generateAll || mode === 'key_points') update.summaryBullets = keyPoints;

  await DocumentModel.findByIdAndUpdate(documentId, update);
  logger.info(`Summaries saved for document ${documentId}`);

  return { short, detailed, keyPoints };
};
