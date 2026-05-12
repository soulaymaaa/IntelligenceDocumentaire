import { chatCompletion } from '../../utils/llm';
import { DocumentModel } from '../documents/document.model';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export type SupportedLanguage = 'ar' | 'en' | 'fr';

const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  ar: 'Arabic',
  en: 'English',
  fr: 'French',
};

// Maximum characters per LLM call — keeps prompts within token budgets
const MAX_CHUNK_CHARS = 3000;

export const translateDocument = async (
  documentId: string,
  ownerId: string,
  targetLanguage: SupportedLanguage,
  sourceLanguage: SupportedLanguage | 'auto' = 'auto'
): Promise<{ translation: string }> => {
  const doc = await DocumentModel.findById(documentId).select('ownerId extractedText originalName').lean();
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  const text = (doc as any).extractedText?.trim() ?? '';
  if (!text) {
    throw new BadRequestError(
      'No extracted text found. Run OCR on this document first before translating.'
    );
  }

  const targetName = LANGUAGE_NAMES[targetLanguage];
  const sourceName =
    sourceLanguage !== 'auto' ? LANGUAGE_NAMES[sourceLanguage] : undefined;

  logger.info(
    `Translation: "${(doc as any).originalName}" → ${targetName} (${text.length} chars)`
  );

  const chunks = splitIntoChunks(text, MAX_CHUNK_CHARS);
  const translatedParts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    logger.info(`  Chunk ${i + 1}/${chunks.length}`);
    const part = await translateChunk(chunks[i], targetName, sourceName);
    translatedParts.push(part);
  }

  return { translation: translatedParts.join('\n\n') };
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const translateChunk = async (
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<string> => {
  const sourceHint = sourceLanguage
    ? `The source text is in ${sourceLanguage}.`
    : 'Detect the source language automatically.';

  const systemPrompt = `You are a professional translator with expertise in Arabic, English, and French.
${sourceHint}
Translate the text the user provides into ${targetLanguage}.

Rules you MUST follow:
- Output ONLY the translated text — no preamble, no notes, no "Translation:", nothing else
- Preserve paragraph breaks and line structure exactly as in the source
- Preserve numbered lists, bullet points, and headings
- Keep proper nouns, acronyms, and technical terms appropriate for ${targetLanguage}
- Do not paraphrase or summarize — translate faithfully`;

  return chatCompletion({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });
};

const splitIntoChunks = (text: string, maxChars: number): string[] => {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > maxChars && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.substring(0, maxChars)];
};
