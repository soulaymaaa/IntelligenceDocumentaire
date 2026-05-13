<<<<<<< HEAD
import { DocumentModel } from '../documents/document.model';
import { logger } from '../../utils/logger';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../utils/errors';
import { chatCompletion } from '../../utils/llm';

const MAX_TRANSLATION_CHUNK_CHARS = 2500;

const normalizeLanguage = (targetLanguage: string): string =>
  targetLanguage.trim().replace(/\s+/g, ' ');

const splitLongBlock = (block: string): string[] => {
  const chunks: string[] = [];

  for (let start = 0; start < block.length; start += MAX_TRANSLATION_CHUNK_CHARS) {
    chunks.push(block.slice(start, start + MAX_TRANSLATION_CHUNK_CHARS).trim());
  }

  return chunks.filter(Boolean);
};

const splitTextForTranslation = (text: string): string[] => {
  const paragraphs = text.trim().split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const block = paragraph.trim();
    if (!block) continue;

    if (block.length > MAX_TRANSLATION_CHUNK_CHARS) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      chunks.push(...splitLongBlock(block));
      continue;
    }

    const next = current ? `${current}\n\n${block}` : block;
    if (next.length > MAX_TRANSLATION_CHUNK_CHARS) {
      if (current) chunks.push(current);
      current = block;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
};

const translateChunk = async (
  text: string,
  targetLanguage: string,
  chunkIndex: number,
  totalChunks: number
): Promise<string> => {
  const partLabel = totalChunks > 1 ? ` This is part ${chunkIndex + 1} of ${totalChunks}.` : '';

  return chatCompletion({
    messages: [
      {
        role: 'system',
        content:
          `You are a professional translator. Translate the provided document text into ${targetLanguage}. ` +
          'Preserve the original meaning, tone, paragraph breaks, headings, lists, dates, numbers, and named entities. ' +
          `Return ONLY the translated text.${partLabel}`,
      },
      { role: 'user', content: text },
    ],
    temperature: 0.2,
    max_tokens: 1600,
  });
};

export const translateDocument = async (
  documentId: string, 
  targetLanguage: string, 
  ownerId: string
): Promise<string> => {
  const normalizedLanguage = normalizeLanguage(targetLanguage);
  if (!normalizedLanguage) throw new BadRequestError('Target language is required');

  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  if (!doc.extractedText || doc.extractedText.trim().length === 0) {
    throw new BadRequestError('Document has no extracted text to translate.');
  }

  // Check if already translated
  const existing = doc.translations?.find(
    (t) => t.language.toLowerCase() === normalizedLanguage.toLowerCase()
  );
  if (existing) return existing.text;

  const chunks = splitTextForTranslation(doc.extractedText);
  logger.info(`Translating document ${documentId} to ${normalizedLanguage} in ${chunks.length} chunk(s)`);

  const translatedChunks: string[] = [];
  for (let index = 0; index < chunks.length; index += 1) {
    translatedChunks.push(await translateChunk(chunks[index], normalizedLanguage, index, chunks.length));
  }

  const translation = translatedChunks.join('\n\n');

  // Save translation
  await DocumentModel.findByIdAndUpdate(documentId, {
    $push: { translations: { language: normalizedLanguage, text: translation } },
  });

  return translation;
=======
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
>>>>>>> 8cc1307b0c4b1c4690e57af12a159aa6776fc8cd
};
