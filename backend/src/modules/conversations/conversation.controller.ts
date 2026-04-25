import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { asyncHandler, successResponse } from '../../utils/helpers';
import { ValidationError } from '../../utils/errors';
import { AuthRequest } from '../../middleware/authenticate';
import { createConversation, getConversation, listConversations, sendMessage } from './conversation.service';

const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  scope: z.enum(['global', 'document']).optional(),
  documentId: z.string().optional(),
});

const sendMessageSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  topK: z.number().min(1).max(10).optional().default(5),
  documentId: z.string().optional(),
});

export const list = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const scope = req.query.scope === 'global' || req.query.scope === 'document' ? req.query.scope : undefined;
  const documentId = typeof req.query.documentId === 'string' ? req.query.documentId : undefined;
  const conversations = await listConversations(req.userId!, scope, documentId);
  return successResponse(res, { conversations });
});

export const create = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  const conversation = await createConversation(req.userId!, parsed.data);
  return successResponse(res, { conversation }, 'Conversation created', 201);
});

export const get = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const conversation = await getConversation(req.params.id, req.userId!);
  return successResponse(res, { conversation });
});

export const send = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError(parsed.error.errors[0].message);

  const conversation = await sendMessage(req.userId!, req.params.id, parsed.data);
  const messages = conversation.messages;
  const answer = messages[messages.length - 1];
  return successResponse(res, {
    conversation,
    answer: {
      answer: answer?.content || '',
      sources: answer?.sources || [],
      hasAnswer: Boolean(answer?.content),
      relevanceScore: answer?.relevanceScore ?? 0,
      confidence: answer?.confidence ?? 'medium',
      highlights: answer?.highlights || [],
    },
  });
});
