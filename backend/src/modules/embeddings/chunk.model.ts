import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IDocumentChunk extends Document {
  documentId: Types.ObjectId;
  ownerId: Types.ObjectId;
  chunkIndex: number;
  pageNumber?: number;
  text: string;
  embedding: number[];
  tokenCount: number;
  createdAt: Date;
}

const documentChunkSchema = new Schema<IDocumentChunk>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    chunkIndex: {
      type: Number,
      required: true,
    },
    pageNumber: {
      type: Number,
      default: undefined,
    },
    text: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      required: true,
      default: [],
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret['__v'];
        return ret;
      },
    },
  }
);

documentChunkSchema.index({ documentId: 1, chunkIndex: 1 });
documentChunkSchema.index({ ownerId: 1 });

// Atlas Vector Search index is created separately via Atlas UI or mongosh:
// db.documentchunks.createIndex({ embedding: "vectorSearch" })

export const DocumentChunkModel: Model<IDocumentChunk> = mongoose.model<IDocumentChunk>(
  'DocumentChunk',
  documentChunkSchema
);
