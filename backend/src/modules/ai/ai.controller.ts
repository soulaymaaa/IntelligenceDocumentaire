import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateSummary } from './summary.service';
import { askQuestion } from '../rag/rag.service';
import { logAction } from '../audit/audit.service';
import { asyncHandler, successResponse } from '../../utils/helpers';
import { ValidationError } from '../../utils/errors';
import { AuthRequest } from '../../middleware/authenticate';

const questionSchema = z.object({
  question: z.string().min(1).max(1000),
  topK: z.number().min(1).max(10).optional().default(5),
});

export const summarizeDocument = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const { id } = req.params;
    const summary = await generateSummary(id, req.userId!);

    await logAction({
      userId: req.userId!,
      action: 'SUMMARY_GENERATED',
      resourceType: 'Document',
      resourceId: id,
    });

    return successResponse(res, { summary }, 'Summary generated successfully');
  }
);

export const askDocument = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const parsed = questionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

    const { id } = req.params;
    const { question, topK } = parsed.data;

    const result = await askQuestion(question, req.userId!, id, topK);

    await logAction({
      userId: req.userId!,
      action: 'RAG_QUESTION',
      resourceType: 'Document',
      resourceId: id,
      metadata: { question: question.substring(0, 200) },
    });

    return successResponse(res, result);
  }
);

export const askGlobal = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    const parsed = questionSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

    const { question, topK } = parsed.data;

    const result = await askQuestion(question, req.userId!, undefined, topK);

    await logAction({
      userId: req.userId!,
      action: 'RAG_GLOBAL_QUESTION',
      resourceType: 'Document',
      metadata: { question: question.substring(0, 200) },
    });

    return successResponse(res, result);
  }
);
