import { Types } from 'mongoose';
import { ConversationModel, type ConversationScope, type IConversation } from './conversation.model';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { askQuestion } from '../rag/rag.service';
import { DocumentModel } from '../documents/document.model';
import { DossierModel } from '../dossiers/dossier.model';

export interface CreateConversationInput {
  title?: string;
  scope?: ConversationScope;
  documentId?: string;
  folderId?: string;
  dossierId?: string;
}

export interface SendMessageInput {
  question: string;
  topK?: number;
  documentId?: string;
  folderId?: string;
  dossierId?: string;
  responseLanguage?: 'fr' | 'en';
}

export const listConversations = async (
  ownerId: string,
  scope?: ConversationScope,
  documentId?: string,
  folderId?: string,
  dossierId?: string
): Promise<IConversation[]> => {
  const filter: Record<string, unknown> = { ownerId };

  if (scope) filter.scope = scope;
  if (documentId) filter.documentId = documentId;
  if (folderId) filter.folderId = folderId;
  if (dossierId) filter.dossierId = dossierId;

  return ConversationModel.find(filter).sort({ lastMessageAt: -1, createdAt: -1 }).lean().exec() as unknown as Promise<IConversation[]>;
};

export const getConversation = async (conversationId: string, ownerId: string): Promise<IConversation> => {
  const conversation = await ConversationModel.findOne({ _id: conversationId, ownerId }).lean().exec();
  if (!conversation) throw new NotFoundError('Conversation');
  return conversation as unknown as IConversation;
};

export const createConversation = async (ownerId: string, input: CreateConversationInput): Promise<IConversation> => {
  const scope = input.scope || 'global';
  const title = input.title?.trim() || (scope === 'document' ? 'Document conversation' : scope === 'folder' ? 'Folder conversation' : scope === 'dossier' ? 'Dossier conversation' : 'Global conversation');

  if (scope === 'document' && !input.documentId) {
    throw new ValidationError('documentId is required for document conversations');
  }

  if (scope === 'folder' && !input.folderId) {
    throw new ValidationError('folderId is required for folder conversations');
  }

  if (scope === 'dossier' && !input.dossierId) {
    throw new ValidationError('dossierId is required for dossier conversations');
  }

  if (input.documentId) {
    const document = await DocumentModel.findOne({ _id: input.documentId, ownerId }).lean().exec();
    if (!document) throw new NotFoundError('Document');
  }

  if (input.dossierId) {
    const dossier = await DossierModel.findOne({ _id: input.dossierId, ownerId }).lean().exec();
    if (!dossier) throw new NotFoundError('Dossier');
  }

  const conversation = await ConversationModel.create({
    ownerId,
    title,
    scope,
    documentId: input.documentId ? new Types.ObjectId(input.documentId) : undefined,
    folderId: input.folderId ? new Types.ObjectId(input.folderId) : undefined,
    dossierId: input.dossierId ? new Types.ObjectId(input.dossierId) : undefined,
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
  const folderId = input.folderId || conversation.folderId?.toString();
  const dossierId = input.dossierId || conversation.dossierId?.toString();
  const question = input.question.trim();

  if (!question) throw new ValidationError('Question is required');

  if (conversation.scope === 'document' && !documentId) {
    throw new ValidationError('documentId is required for document conversations');
  }

  if (conversation.scope === 'folder' && !folderId) {
    throw new ValidationError('folderId is required for folder conversations');
  }

  if (conversation.scope === 'dossier' && !dossierId) {
    throw new ValidationError('dossierId is required for dossier conversations');
  }

  const userMessage = {
    role: 'user' as const,
    content: question,
    createdAt: new Date(),
  };

  conversation.messages.push(userMessage);

  const answer = await askQuestion(question, ownerId, documentId, input.topK || 5, input.responseLanguage, folderId, dossierId);

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

  if (!conversation.title || conversation.title === 'New document thread' || conversation.title === 'New global conversation' || conversation.title === 'Folder conversation' || conversation.title === 'Dossier conversation') {
    conversation.title = question.slice(0, 80);
  }

  await conversation.save();
  return conversation.toJSON() as unknown as IConversation;
};
