import mongoose from 'mongoose';
import { DocumentChunkModel } from './chunk.model';
import { DocumentModel } from '../documents/document.model';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { chunkArray, cosineSimilarity } from '../../utils/helpers';

let extractorPipeline: any = null;

const getExtractor = async () => {
  if (!extractorPipeline) {
    const { pipeline, env: xenovaEnv } = await import('@xenova/transformers');

    xenovaEnv.localModelPath = './models';
    xenovaEnv.allowRemoteModels = true;

    logger.info('Initializing Xenova local embedding model (all-MiniLM-L6-v2)...');
    extractorPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    logger.info('Embedding model ready');
  }
  return extractorPipeline;
};

const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 120;
const MIN_CHUNK_SIZE = 80;
const EMBEDDING_BATCH_SIZE = 8;

export const chunkText = (text: string): string[] => {
  const normalised = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const rawChunks = splitIntoRawChunks(normalised);
  return addOverlap(mergeSmallChunks(rawChunks));
};

const splitIntoRawChunks = (text: string): string[] => {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const isHeading = /^(#{1,6}\s|\d+\.\s|[A-Z][A-Z\s]{2,}:)/.test(trimmed);
    if (isHeading && current.length > MIN_CHUNK_SIZE) {
      chunks.push(current.trim());
      current = trimmed;
      continue;
    }

    const combined = current ? `${current}\n\n${trimmed}` : trimmed;

    if (combined.length <= CHUNK_SIZE) {
      current = combined;
      continue;
    }

    if (current.length >= MIN_CHUNK_SIZE) {
      chunks.push(current.trim());
    }

    if (trimmed.length <= CHUNK_SIZE) {
      current = trimmed;
      continue;
    }

    const sentenceChunks = splitBySentence(trimmed);
    if (sentenceChunks.length > 1) {
      chunks.push(...sentenceChunks.slice(0, -1));
      current = sentenceChunks[sentenceChunks.length - 1];
      continue;
    }

    const wordChunks = splitByWords(trimmed);
    chunks.push(...wordChunks.slice(0, -1));
    current = wordChunks[wordChunks.length - 1] || '';
  }

  if (current.trim().length >= MIN_CHUNK_SIZE || (current.trim().length > 0 && chunks.length === 0)) {
    chunks.push(current.trim());
  }

  return chunks;
};

const splitBySentence = (text: string): string[] => {
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
    const overlapRaw = prev.substring(Math.max(0, prev.length - CHUNK_OVERLAP));
    const overlap = overlapRaw.replace(/^\S+\s/, '');
    return overlap ? `${overlap} ${chunk}` : chunk;
  });
};

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

export const indexDocument = async (documentId: string, text: string): Promise<void> => {
  await DocumentChunkModel.deleteMany({ documentId });

  const doc = await DocumentModel.findById(documentId).select('ownerId originalName').lean();
  if (!doc) throw new Error(`Document ${documentId} not found for indexing`);

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    logger.warn(`No chunks produced for document ${documentId}; text may be empty`);
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

const normalizeLexical = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const LEXICAL_STOP_WORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'dans', 'de', 'des', 'du', 'est', 'for', 'is', 'la', 'le', 'les',
  'me', 'of', 'on', 'pour', 'que', 'qui', 'the', 'this', 'un', 'une', 'what',
]);

const tokenAliases = (token: string): string[] => {
  const aliases: Record<string, string[]> = {
    etudiant: ['etudiant', 'etudiante', 'etudiant(e)', 'stagiaire', 'student'],
    student: ['student', 'etudiant', 'etudiante', 'stagiaire'],
    stagiaire: ['stagiaire', 'etudiant', 'etudiante', 'student'],
    nom: ['nom', 'name', 'appele', 'appelle'],
    name: ['name', 'nom'],
    cin: ['cin', 'cni', 'numero'],
  };
  return aliases[token] || [token];
};

const buildLexicalGroups = (query: string): string[][] => {
  const tokens = normalizeLexical(query)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !LEXICAL_STOP_WORDS.has(token));

  const uniqueTokens = Array.from(new Set(tokens));
  return uniqueTokens.map((token) => Array.from(new Set(tokenAliases(token).map(normalizeLexical))));
};

export const semanticSearch = async (
  queryEmbedding: number[],
  ownerId: string,
  topK = 5,
  documentId?: string,
  folderId?: string,
  dossierId?: string
): Promise<Array<{ chunk: any; score: number }>> => {
  if (env.VECTOR_SEARCH_ENABLED) {
    const vectorResults = await vectorSemanticSearch(queryEmbedding, ownerId, topK, documentId, folderId, dossierId);
    if (vectorResults) return vectorResults;
  }

  return cosineSemanticSearch(queryEmbedding, ownerId, topK, documentId, folderId, dossierId);
};

export const lexicalSearch = async (
  query: string,
  ownerId: string,
  topK = 5,
  documentId?: string,
  folderId?: string,
  dossierId?: string
): Promise<Array<{ chunk: any; score: number }>> => {
  const groups = buildLexicalGroups(query);
  if (groups.length === 0) return [];

  const filter = await buildChunkFilter(ownerId, documentId, folderId, dossierId);
  const chunks = await DocumentChunkModel.find(filter)
    .populate('documentId', 'originalName')
    .lean();

  if (chunks.length === 0) return [];

  return chunks
    .map((chunk) => {
      const text = normalizeLexical(`${(chunk.documentId as any)?.originalName || ''}\n${chunk.text}`);
      const matchedGroups = groups.filter((aliases) => aliases.some((alias) => text.includes(alias)));
      const matchedCount = matchedGroups.length;
      const occurrenceBonus = Math.min(
        0.18,
        matchedGroups.reduce((sum, aliases) => {
          const hits = aliases.reduce((aliasHits, alias) => {
            const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            return aliasHits + (text.match(pattern)?.length || 0);
          }, 0);
          return sum + Math.min(hits, 3) * 0.03;
        }, 0)
      );

      return {
        chunk,
        score: matchedCount === 0 ? 0 : Math.min(0.72, 0.14 + (matchedCount / groups.length) * 0.42 + occurrenceBonus),
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

const buildChunkFilter = async (
  ownerId: string,
  documentId?: string,
  folderId?: string,
  dossierId?: string
): Promise<Record<string, unknown>> => {
  const filter: Record<string, unknown> = { ownerId };
  if (documentId) filter.documentId = documentId;

  if (folderId) {
    const docsInFolder = await DocumentModel.find({ folderId, ownerId }).select('_id').lean();
    filter.documentId = { $in: docsInFolder.map((doc) => doc._id) };
  }

  if (dossierId) {
    const docsInDossier = await DocumentModel.find({ dossierId, ownerId }).select('_id').lean();
    filter.documentId = { $in: docsInDossier.map((doc) => doc._id) };
  }

  return filter;
};

const cosineSemanticSearch = async (
  queryEmbedding: number[],
  ownerId: string,
  topK = 5,
  documentId?: string,
  folderId?: string,
  dossierId?: string
): Promise<Array<{ chunk: any; score: number }>> => {
  const filter = await buildChunkFilter(ownerId, documentId, folderId, dossierId);
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

const buildVectorFilter = async (
  ownerId: string,
  documentId?: string,
  folderId?: string,
  dossierId?: string
): Promise<Record<string, unknown>> => {
  const filter: Record<string, unknown> = { ownerId: new mongoose.Types.ObjectId(ownerId) };
  if (documentId) filter.documentId = new mongoose.Types.ObjectId(documentId);

  if (folderId) {
    const docsInFolder = await DocumentModel.find({ folderId, ownerId }).select('_id').lean();
    filter.documentId = { $in: docsInFolder.map((doc) => doc._id) };
  }

  if (dossierId) {
    const docsInDossier = await DocumentModel.find({ dossierId, ownerId }).select('_id').lean();
    filter.documentId = { $in: docsInDossier.map((doc) => doc._id) };
  }

  return filter;
};

const vectorSemanticSearch = async (
  queryEmbedding: number[],
  ownerId: string,
  topK = 5,
  documentId?: string,
  folderId?: string,
  dossierId?: string
): Promise<Array<{ chunk: any; score: number }> | null> => {
  try {
    const filter = await buildVectorFilter(ownerId, documentId, folderId, dossierId);
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
