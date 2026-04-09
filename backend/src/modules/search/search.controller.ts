import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateEmbedding, semanticSearch } from '../embeddings/embedding.service';
import { asyncHandler, successResponse } from '../../utils/helpers';
import { ValidationError } from '../../utils/errors';
import { AuthRequest } from '../../middleware/authenticate';

const searchSchema = z.object({
  query: z.string().min(1).max(500),
  topK: z.number().min(1).max(20).optional().default(5),
  documentId: z.string().optional(),
});

export const semanticSearchHandler = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

    const { query, topK, documentId } = parsed.data;

    const queryEmbedding = await generateEmbedding(query);
    const results = await semanticSearch(queryEmbedding, req.userId!, topK, documentId);

    const formatted = results.map(({ chunk, score }) => ({
      chunkId: chunk._id,
      documentId: chunk.documentId?._id || chunk.documentId,
      documentName: (chunk.documentId as any)?.originalName,
      text: chunk.text,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      score: Math.round(score * 1000) / 1000,
    }));

    return successResponse(res, { results: formatted, query });
  }
);
