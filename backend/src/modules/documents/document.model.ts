import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type DocumentStatus = 'pending' | 'processing_ocr' | 'indexed' | 'error' | 'archived';

export interface IDocument extends Document {
  ownerId: Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  status: DocumentStatus;
  extractedText?: string;
  pageCount?: number;
  summary?: string;
  archived: boolean;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing_ocr', 'indexed', 'error', 'archived'],
      default: 'pending',
      index: true,
    },
    extractedText: {
      type: String,
      default: undefined,
    },
    pageCount: {
      type: Number,
      default: undefined,
    },
    summary: {
      type: String,
      default: undefined,
    },
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
    errorMessage: {
      type: String,
      default: undefined,
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

documentSchema.index({ ownerId: 1, status: 1 });
documentSchema.index({ ownerId: 1, archived: 1 });
documentSchema.index({ ownerId: 1, originalName: 'text' });

export const DocumentModel: Model<IDocument> = mongoose.model<IDocument>('Document', documentSchema);
