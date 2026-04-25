import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import type { RagSource } from '../rag/rag.service';

export interface RagHighlight {
  sourceIndex: number;
  snippet: string;
  matchedTerms: string[];
}

export type ConversationScope = 'global' | 'document';
export type ConversationRole = 'user' | 'assistant';

export interface IConversationMessage {
  role: ConversationRole;
  content: string;
  createdAt: Date;
  relevanceScore?: number;
  confidence?: 'high' | 'medium' | 'low';
  sources?: RagSource[];
  highlights?: RagHighlight[];
}

export interface IConversation extends Document {
  ownerId: Types.ObjectId;
  title: string;
  scope: ConversationScope;
  documentId?: Types.ObjectId;
  messages: IConversationMessage[];
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conversationMessageSchema = new Schema<IConversationMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    relevanceScore: {
      type: Number,
      default: undefined,
    },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: undefined,
    },
    sources: {
      type: [Schema.Types.Mixed],
      default: undefined,
    },
    highlights: {
      type: [Schema.Types.Mixed],
      default: undefined,
    },
  },
  { _id: false }
);

const conversationSchema = new Schema<IConversation>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    scope: {
      type: String,
      enum: ['global', 'document'],
      required: true,
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      default: undefined,
      index: true,
    },
    messages: {
      type: [conversationMessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret['__v'];
        return ret;
      },
    },
  }
);

conversationSchema.index({ ownerId: 1, scope: 1, lastMessageAt: -1 });
conversationSchema.index({ ownerId: 1, documentId: 1, lastMessageAt: -1 });

export const ConversationModel: Model<IConversation> = mongoose.model<IConversation>(
  'Conversation',
  conversationSchema
);
