import { pipeline, env as xenovaEnv } from '@xenova/transformers';
import { DocumentChunkModel } from './chunk.model';
import { DocumentModel } from '../documents/document.model';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { chunkArray, cosineSimilarity } from '../../utils/helpers';

// Provide local cache folder configuration for xenova
xenovaEnv.localModelPath = './models';
xenovaEnv.allowRemoteModels = true; // Allows downloading model once

let extractorPipeline: any = null;

const getExtractor = async () => {
  if (!extractorPipeline) {
    logger.info('Initializing Xenova local embedding model...');
    extractorPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  }
  return extractorPipeline;
};

const CHUNK_SIZE = 800;          // characters per chunk
const CHUNK_OVERLAP = 100;       // character overlap between chunks
const EMBEDDING_BATCH_SIZE = 10; // slightly smaller since it runs locally on CPU

// ── Text chunking ────────────────────────────────────────────────────────────

export const chunkText = (text: string): string[] => {
  const chunks: string[] = [];
  // Try to split on paragraphs first
  const paragraphs = text.split(/\n\s*\n/);
  let current = '';

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if ((current + ' ' + trimmed).length <= CHUNK_SIZE) {
      current = current ? current + '\n\n' + trimmed : trimmed;
    } else {
      if (current) chunks.push(current.trim());

      // If single paragraph is too long, split by sentence
      if (trimmed.length > CHUNK_SIZE) {
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        current = '';
        for (const sentence of sentences) {
          if ((current + ' ' + sentence).length <= CHUNK_SIZE) {
            current = current ? current + ' ' + sentence : sentence;
          } else {
            if (current) chunks.push(current.trim());
            current = sentence;
          }
        }
      } else {
        current = trimmed;
      }
    }
  }

  if (current.trim()) chunks.push(current.trim());

  // Add overlap context
  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const prev = chunks[i - 1];
    const overlap = prev.substring(Math.max(0, prev.length - CHUNK_OVERLAP));
    return overlap + ' ' + chunk;
  });
};

// ── Embeddings ───────────────────────────────────────────────────────────────

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const extractor = await getExtractor();
  const output = await extractor(text.substring(0, 8000), { pooling: 'mean', normalize: true });
  return Array.from(output.data);
};

const generateEmbeddingsBatch = async (texts: string[]): Promise<number[][]> => {
  const extractor = await getExtractor();
  const output = await extractor(texts.map((t) => t.substring(0, 8000)), { pooling: 'mean', normalize: true });
  return output.tolist();
};

// ── Indexing ─────────────────────────────────────────────────────────────────

export const indexDocument = async (documentId: string, text: string): Promise<void> => {
  // Remove old chunks
  await DocumentChunkModel.deleteMany({ documentId });

  const doc = await DocumentModel.findById(documentId).select('ownerId').lean();
  if (!doc) throw new Error('Document not found for indexing');

  const chunks = chunkText(text);
  logger.info(`Indexing ${chunks.length} chunks for document ${documentId}`);

  // Process in batches to respect API rate limits
  const batches = chunkArray(chunks, EMBEDDING_BATCH_SIZE);

  let chunkIndex = 0;
  for (const batch of batches) {
    const embeddings = await generateEmbeddingsBatch(batch);

    const chunkDocs = batch.map((chunkText, i) => ({
      documentId,
      ownerId: doc.ownerId,
      chunkIndex: chunkIndex + i,
      text: chunkText,
      embedding: embeddings[i],
      tokenCount: Math.ceil(chunkText.length / 4), // rough token estimate
    }));

    await DocumentChunkModel.insertMany(chunkDocs);
    chunkIndex += batch.length;
  }

  logger.info(`Indexed ${chunkIndex} chunks for document ${documentId}`);
};

// ── Semantic Search (cosine similarity fallback) ──────────────────────────────

export const semanticSearch = async (
  queryEmbedding: number[],
  ownerId: string,
  topK = 5,
  documentId?: string
): Promise<Array<{ chunk: any; score: number }>> => {
  const filter: any = { ownerId };
  if (documentId) filter.documentId = documentId;

  // Load all chunks for this user (with embeddings)
  // NOTE: In production with MongoDB Atlas, use $vectorSearch aggregation
  const chunks = await DocumentChunkModel.find(filter)
    .populate('documentId', 'originalName')
    .lean();

  if (chunks.length === 0) return [];

  // Compute cosine similarity
  const scored = chunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
};
