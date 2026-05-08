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
};
