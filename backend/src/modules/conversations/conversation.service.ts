import { Types } from 'mongoose';
import { ConversationModel, type ConversationScope, type IConversation } from './conversation.model';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { askQuestion } from '../rag/rag.service';
import { DocumentModel } from '../documents/document.model';

export interface CreateConversationInput {
  title?: string;
  scope?: ConversationScope;
  documentId?: string;
}

export interface SendMessageInput {
  question: string;
  topK?: number;
  documentId?: string;
  responseLanguage?: 'fr' | 'en';
}

export const listConversations = async (
  ownerId: string,
  scope?: ConversationScope,
  documentId?: string
): Promise<IConversation[]> => {
  const filter: Record<string, unknown> = { ownerId };

  if (scope) filter.scope = scope;
  if (documentId) filter.documentId = documentId;

  return ConversationModel.find(filter).sort({ lastMessageAt: -1, createdAt: -1 }).lean().exec() as unknown as Promise<IConversation[]>;
};

export const getConversation = async (conversationId: string, ownerId: string): Promise<IConversation> => {
  const conversation = await ConversationModel.findOne({ _id: conversationId, ownerId }).lean().exec();
  if (!conversation) throw new NotFoundError('Conversation');
  return conversation as unknown as IConversation;
};

export const createConversation = async (ownerId: string, input: CreateConversationInput): Promise<IConversation> => {
  const scope = input.scope || 'global';
  const title = input.title?.trim() || (scope === 'document' ? 'Document conversation' : 'Global conversation');

  if (scope === 'document' && !input.documentId) {
    throw new ValidationError('documentId is required for document conversations');
  }

  if (input.documentId) {
    const document = await DocumentModel.findOne({ _id: input.documentId, ownerId }).lean().exec();
    if (!document) throw new NotFoundError('Document');
  }

  const conversation = await ConversationModel.create({
    ownerId,
    title,
    scope,
    documentId: input.documentId ? new Types.ObjectId(input.documentId) : undefined,
    messages: [],
    lastMessageAt: new Date(),
  });

  return conversation.toJSON() as unknown as IConversation;
};

export const sendMessage = async (
  ownerId: string,
  conversationId: string,
  input: SendMessageInput
): Promise<IConversation> => {
  const conversation = await ConversationModel.findOne({ _id: conversationId, ownerId }).exec();
  if (!conversation) throw new NotFoundError('Conversation');

  const documentId = input.documentId || conversation.documentId?.toString();
  const question = input.question.trim();

  if (!question) throw new ValidationError('Question is required');

  if (conversation.scope === 'document' && !documentId) {
    throw new ValidationError('documentId is required for document conversations');
  }

  const userMessage = {
    role: 'user' as const,
    content: question,
    createdAt: new Date(),
  };

  conversation.messages.push(userMessage);

  const answer = await askQuestion(question, ownerId, documentId, input.topK || 5, input.responseLanguage);

  const assistantMessage = {
    role: 'assistant' as const,
    content: answer.answer,
    createdAt: new Date(),
    relevanceScore: answer.relevanceScore,
    confidence: answer.confidence,
    sources: answer.sources,
    highlights: answer.highlights?.length
      ? answer.highlights
      : answer.sources.map((source, index) => ({
          sourceIndex: index,
          snippet: source.text.substring(0, 300),
          matchedTerms: [],
        })),
  };

  conversation.messages.push(assistantMessage);
  conversation.lastMessageAt = new Date();

  if (!conversation.title || conversation.title === 'New document thread' || conversation.title === 'New global conversation') {
    conversation.title = question.slice(0, 80);
  }

  await conversation.save();
  return conversation.toJSON() as unknown as IConversation;
};
