import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IDossier extends Document {
  ownerId: Types.ObjectId;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

const dossierSchema = new Schema<IDossier>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    color: { type: String, default: '#6366F1' },
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

dossierSchema.index({ ownerId: 1 });

export const DossierModel: Model<IDossier> = mongoose.model<IDossier>('Dossier', dossierSchema);
