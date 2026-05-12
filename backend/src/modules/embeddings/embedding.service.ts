import { pipeline, env as xenovaEnv } from '@xenova/transformers';
import mongoose from 'mongoose';
import { DocumentChunkModel } from './chunk.model';
import { DocumentModel } from '../documents/document.model';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { chunkArray, cosineSimilarity } from '../../utils/helpers';

xenovaEnv.localModelPath = './models';
xenovaEnv.allowRemoteModels = true;

let extractorPipeline: any = null;

const getExtractor = async () => {
  if (!extractorPipeline) {
    logger.info('Initializing Xenova local embedding model (all-MiniLM-L6-v2)...');
    extractorPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    logger.info('Embedding model ready');
  }
  return extractorPipeline;
};

// ── Chunking configuration ────────────────────────────────────────────────────

const CHUNK_SIZE = 600;          // target characters per chunk (smaller = more precise retrieval)
const CHUNK_OVERLAP = 120;       // characters of overlap for continuity
const MIN_CHUNK_SIZE = 80;       // discard tiny fragments
const EMBEDDING_BATCH_SIZE = 8;  // batch size for CPU inference

// ── Smart text chunking ───────────────────────────────────────────────────────

/**
 * Splits text into semantically coherent chunks with overlap.
 *
 * Strategy (priority order):
 * 1. Split on double newlines (paragraph boundaries)
 * 2. Within an oversized paragraph, split on sentence endings
 * 3. Within an oversized sentence, split at word boundaries near CHUNK_SIZE
 *
 * Overlap is added by prepending the tail of the previous chunk so the
 * embedding model has context for the current chunk's beginning.
 */
export const chunkText = (text: string): string[] => {
  // Normalise whitespace — collapse 3+ newlines to 2, tabs to space
  const normalised = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const rawChunks = splitIntoRawChunks(normalised);

  // Merge tiny trailing fragments into the preceding chunk
  const merged = mergeSmallChunks(rawChunks);

  // Add overlap context from the previous chunk
  return addOverlap(merged);
};

const splitIntoRawChunks = (text: string): string[] => {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Heading detection — start a new chunk for headings
    const isHeading = /^(#{1,6}\s|\d+\.\s|[A-Z][A-Z\s]{2,}:)/.test(trimmed);
    if (isHeading && current.length > MIN_CHUNK_SIZE) {
      chunks.push(current.trim());
      current = trimmed;
      continue;
    }

    const combined = current ? `${current}\n\n${trimmed}` : trimmed;

    if (combined.length <= CHUNK_SIZE) {
      current = combined;
    } else {
      // Flush current buffer before processing the new paragraph
      if (current.length >= MIN_CHUNK_SIZE) {
        chunks.push(current.trim());
      }

      if (trimmed.length <= CHUNK_SIZE) {
        current = trimmed;
      } else {
        // Oversized paragraph → split by sentence
        const sentenceChunks = splitBySentence(trimmed);
        if (sentenceChunks.length > 1) {
          chunks.push(...sentenceChunks.slice(0, -1));
          current = sentenceChunks[sentenceChunks.length - 1];
        } else {
          // No sentence boundaries — hard split at word boundaries
          const wordChunks = splitByWords(trimmed);
          chunks.push(...wordChunks.slice(0, -1));
          current = wordChunks[wordChunks.length - 1] || '';
        }
      }
    }
  }

  if (current.trim().length >= MIN_CHUNK_SIZE) {
    chunks.push(current.trim());
  }

  return chunks;
};

const splitBySentence = (text: string): string[] => {
  // Match sentence-ending punctuation followed by whitespace or end
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= CHUNK_SIZE) {
      current = candidate;
    } else {
      if (current.length >= MIN_CHUNK_SIZE) chunks.push(current.trim());
      current = sentence.length > CHUNK_SIZE ? splitByWords(sentence)[0] : sentence;
    }
  }

  if (current.trim().length >= MIN_CHUNK_SIZE) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
};

const splitByWords = (text: string): string[] => {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= CHUNK_SIZE) {
      current = candidate;
    } else {
      if (current.length >= MIN_CHUNK_SIZE) chunks.push(current.trim());
      current = word;
    }
  }

  if (current.trim().length >= MIN_CHUNK_SIZE) chunks.push(current.trim());
  return chunks.length ? chunks : [text.substring(0, CHUNK_SIZE)];
};

const mergeSmallChunks = (chunks: string[]): string[] => {
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length < MIN_CHUNK_SIZE && result.length > 0) {
      result[result.length - 1] += ' ' + chunk;
    } else {
      result.push(chunk);
    }
  }
  return result;
};

const addOverlap = (chunks: string[]): string[] => {
  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;
    const prev = chunks[i - 1];
    // Take the last CHUNK_OVERLAP characters of the previous chunk at a word boundary
    const overlapRaw = prev.substring(Math.max(0, prev.length - CHUNK_OVERLAP));
    const overlap = overlapRaw.replace(/^\S+\s/, ''); // start at a word boundary
    return overlap ? `${overlap} ${chunk}` : chunk;
  });
};

// ── Embedding generation ──────────────────────────────────────────────────────

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const extractor = await getExtractor();
  const output = await extractor(text.substring(0, 8000), { pooling: 'mean', normalize: true });
  return Array.from(output.data);
};

const generateEmbeddingsBatch = async (texts: string[]): Promise<number[][]> => {
  const extractor = await getExtractor();
  const output = await extractor(
    texts.map((t) => t.substring(0, 8000)),
    { pooling: 'mean', normalize: true }
  );
  return output.tolist();
};

// ── Indexing pipeline ─────────────────────────────────────────────────────────

export const indexDocument = async (documentId: string, text: string): Promise<void> => {
  // Remove stale chunks from a previous indexing run
  await DocumentChunkModel.deleteMany({ documentId });

  const doc = await DocumentModel.findById(documentId).select('ownerId originalName').lean();
  if (!doc) throw new Error(`Document ${documentId} not found for indexing`);

  const chunks = chunkText(text);

  if (chunks.length === 0) {
    logger.warn(`No chunks produced for document ${documentId} — text may be empty`);
    return;
  }

  logger.info(`Indexing ${chunks.length} chunks for "${(doc as any).originalName}" (${documentId})`);

  const batches = chunkArray(chunks, EMBEDDING_BATCH_SIZE);
  let chunkIndex = 0;

  for (let batchNum = 0; batchNum < batches.length; batchNum++) {
    const batch = batches[batchNum];
    logger.info(`  Embedding batch ${batchNum + 1}/${batches.length} (${batch.length} chunks)`);

    const embeddings = await generateEmbeddingsBatch(batch);

    const chunkDocs = batch.map((text, i) => ({
      documentId,
      ownerId: doc.ownerId,
      chunkIndex: chunkIndex + i,
      text,
      embedding: embeddings[i],
      tokenCount: Math.ceil(text.length / 4),
    }));

    await DocumentChunkModel.insertMany(chunkDocs);
    chunkIndex += batch.length;
  }

  logger.info(`Indexing complete: ${chunkIndex} chunks stored for document ${documentId}`);
};

// ── Semantic search ───────────────────────────────────────────────────────────

export const semanticSearch = async (
  queryEmbedding: number[],
  ownerId: string,
  topK = 5,
  documentId?: string
): Promise<Array<{ chunk: any; score: number }>> => {
  if (env.VECTOR_SEARCH_ENABLED) {
    const vectorResults = await vectorSemanticSearch(queryEmbedding, ownerId, topK, documentId);
    if (vectorResults) return vectorResults;
  }

  return cosineSemanticSearch(queryEmbedding, ownerId, topK, documentId);
};

const cosineSemanticSearch = async (
  queryEmbedding: number[],
  ownerId: string,
  topK = 5,
  documentId?: string
): Promise<Array<{ chunk: any; score: number }>> => {
  const filter: any = { ownerId };
  if (documentId) filter.documentId = documentId;

  const chunks = await DocumentChunkModel.find(filter)
    .populate('documentId', 'originalName')
    .lean();

  if (chunks.length === 0) return [];

  return chunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

type AtlasVectorSearchResult = {
  _id: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  chunkIndex: number;
  pageNumber?: number;
  text: string;
  score: number;
  documentOriginalName?: string;
};

const vectorSemanticSearch = async (
  queryEmbedding: number[],
  ownerId: string,
  topK = 5,
  documentId?: string
): Promise<Array<{ chunk: any; score: number }> | null> => {
  try {
    const ownerObjectId = new mongoose.Types.ObjectId(ownerId);
    const filter: Record<string, unknown> = { ownerId: ownerObjectId };
    if (documentId) filter.documentId = new mongoose.Types.ObjectId(documentId);

    const numCandidates = Math.max(topK * 20, 100);

    const agg = [
      {
        $vectorSearch: {
          index: env.VECTOR_SEARCH_INDEX_NAME,
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates,
          limit: topK,
          filter,
        },
      },
      { $set: { score: { $meta: 'vectorSearchScore' } } },
      {
        $lookup: {
          from: 'documents',
          localField: 'documentId',
          foreignField: '_id',
          as: 'document',
        },
      },
      { $unwind: { path: '$document', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          documentId: 1,
          chunkIndex: 1,
          pageNumber: 1,
          text: 1,
          score: 1,
          documentOriginalName: '$document.originalName',
        },
      },
    ];

    const results = await DocumentChunkModel.aggregate<AtlasVectorSearchResult>(agg);

    return results.map((result) => ({
      chunk: {
        _id: result._id,
        chunkIndex: result.chunkIndex,
        pageNumber: result.pageNumber,
        text: result.text,
        documentId: result.documentOriginalName
          ? { _id: result.documentId, originalName: result.documentOriginalName }
          : result.documentId,
      },
      score: result.score,
    }));
  } catch (error) {
    logger.warn('Atlas Vector Search unavailable, falling back to cosine similarity', {
      indexName: env.VECTOR_SEARCH_INDEX_NAME,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
