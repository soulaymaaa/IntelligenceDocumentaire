import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateSummary } from './summary.service';
import { askQuestion } from '../rag/rag.service';
import { logAction } from '../audit/audit.service';
import { asyncHandler, successResponse } from '../../utils/helpers';
import { ValidationError, BadRequestError } from '../../utils/errors';
import { AuthRequest } from '../../middleware/authenticate';
import { logger } from '../../utils/logger';
import { LLMError } from '../../utils/llm';

const questionSchema = z.object({
  question: z.string().min(1).max(1000),
  topK: z.number().min(1).max(10).optional().default(5),
});

const handleAiError = (err: any): never => {
  // Custom LLMError from our provider layer
  if (err instanceof LLMError) {
    if (err.type === 'config') {
      throw new BadRequestError(err.message);
    }
    if (err.type === 'no_credits') {
      throw new BadRequestError(err.message);
    }
  }

  // Rate limit errors
  if (err.status === 429) {
    throw new BadRequestError('AI service is rate-limited. Please wait a moment and try again.');
  }

  // No credits (OpenRouter)
  if (err.status === 402) {
    throw new BadRequestError(
      'OpenRouter account has no credits. Add credits at https://openrouter.ai/settings/credits, ' +
      'or configure GROQ_API_KEY in .env for free access (no credits needed).'
    );
  }

  // Provider errors
  if (err.message && (err.message.includes('Provider') || err.message.includes('model'))) {
    logger.error('AI provider error:', err.message);
    throw new BadRequestError('AI service is temporarily unavailable. Please try again.');
  }

  throw err;
};

export const summarizeDocument = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    try {
      const { id } = req.params;
      const summary = await generateSummary(id, req.userId!);

      await logAction({
        userId: req.userId!,
        action: 'SUMMARY_GENERATED',
        resourceType: 'Document',
        resourceId: id,
      });

      return successResponse(res, { summary }, 'Summary generated successfully');
    } catch (err) {
      handleAiError(err);
    }
  }
);

export const askDocument = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    try {
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
    } catch (err) {
      handleAiError(err);
    }
  }
);

export const askGlobal = asyncHandler(
  async (req: AuthRequest, res: Response, _next: NextFunction) => {
    try {
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
    } catch (err) {
      handleAiError(err);
    }
  }
);
