import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IDocumentFolder extends Document {
  ownerId: Types.ObjectId;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentFolderSchema = new Schema<IDocumentFolder>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    color: {
      type: String,
      default: '#2563eb',
      match: /^#[0-9A-Fa-f]{6}$/,
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

documentFolderSchema.index({ ownerId: 1, name: 1 }, { unique: true });

export const DocumentFolderModel: Model<IDocumentFolder> = mongoose.model<IDocumentFolder>(
  'DocumentFolder',
  documentFolderSchema
);
