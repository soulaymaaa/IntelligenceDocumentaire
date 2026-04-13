import { DocumentModel, IDocument, DocumentStatus } from './document.model';
import { DocumentChunkModel } from '../embeddings/chunk.model';
import { deleteFile } from '../uploads/upload.middleware';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { paginationMeta } from '../../utils/helpers';
import path from 'path';
import { env } from '../../config/env';

interface ListDocumentsParams {
  ownerId: string;
  page?: number;
  limit?: number;
  status?: DocumentStatus;
  search?: string;
  archived?: boolean;
}

export const listDocuments = async (params: ListDocumentsParams) => {
  const { ownerId, page = 1, limit = 20, status, search, archived } = params;

  const query: any = { ownerId };
  if (status) query.status = status;
  if (typeof archived === 'boolean') query.archived = archived;
  if (search) query.originalName = { $regex: search, $options: 'i' };

  const [docs, total] = await Promise.all([
    DocumentModel.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-__v')
      .lean(),
    DocumentModel.countDocuments(query),
  ]);

  return { documents: docs, meta: paginationMeta(total, page, limit) };
};

export const getDocument = async (id: string, ownerId: string): Promise<IDocument> => {
  const doc = await DocumentModel.findById(id).select('-__v').lean().exec();
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();
  return doc as unknown as IDocument;
};

export const createDocument = async (data: {
  ownerId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
}): Promise<IDocument> => {
  const doc = await DocumentModel.create({
    ...data,
    status: 'pending',
    archived: false,
  });
  return doc;
};

export const updateDocumentStatus = async (
  id: string,
  status: DocumentStatus,
  extras?: Partial<IDocument>
): Promise<IDocument | null> => {
  return DocumentModel.findByIdAndUpdate(
    id,
    { status, ...extras, updatedAt: new Date() },
    { new: true }
  );
};

export const archiveDocument = async (id: string, ownerId: string): Promise<IDocument> => {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  doc.archived = true;
  doc.status = 'archived';
  await doc.save();
  return doc;
};

export const deleteDocument = async (id: string, ownerId: string): Promise<void> => {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  // Delete physical file
  const absolutePath = path.resolve(process.cwd(), env.UPLOAD_DIR, doc.filename);
  deleteFile(absolutePath);

  // Delete all chunks/embeddings
  await DocumentChunkModel.deleteMany({ documentId: id });

  // Delete document record
  await DocumentModel.findByIdAndDelete(id);
};

export const getDashboardStats = async (ownerId: string) => {
  const [total, indexed, pending, errors, archived, recent] = await Promise.all([
    DocumentModel.countDocuments({ ownerId }),
    DocumentModel.countDocuments({ ownerId, status: 'indexed' }),
    DocumentModel.countDocuments({ ownerId, status: { $in: ['pending', 'processing_ocr'] } }),
    DocumentModel.countDocuments({ ownerId, status: 'error' }),
    DocumentModel.countDocuments({ ownerId, archived: true }),
    DocumentModel.find({ ownerId }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  return { total, indexed, pending, errors, archived, recent };
};
