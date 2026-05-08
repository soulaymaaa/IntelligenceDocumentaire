import { DocumentModel, IDocument, DocumentStatus } from './document.model';
import { DocumentChunkModel } from '../embeddings/chunk.model';
import { deleteFile } from '../uploads/upload.middleware';
import { NotFoundError, ForbiddenError } from '../../utils/errors';
import { paginationMeta } from '../../utils/helpers';
import path from 'path';
import fs from 'fs';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  createImagePdfPreview,
  getImagePreviewPdfFilename,
  isImageMimeType,
} from './pdf-preview.service';

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
  return ensureImagePreview(doc as unknown as IDocument);
};

export const createDocument = async (data: {
  ownerId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  ocrPdfPath?: string;
  pageCount?: number;
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

export const restoreDocument = async (id: string, ownerId: string): Promise<IDocument> => {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  const hasIndexedChunks = await DocumentChunkModel.exists({ documentId: id });

  doc.archived = false;
  doc.status = hasIndexedChunks ? 'indexed' : doc.errorMessage ? 'error' : 'pending';
  await doc.save();
  return doc;
};

export const deleteDocument = async (id: string, ownerId: string): Promise<void> => {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const filenamesToDelete = new Set<string>([doc.filename]);
  if (doc.ocrPdfPath) filenamesToDelete.add(doc.ocrPdfPath);
  if (isImageMimeType(doc.mimeType)) {
    filenamesToDelete.add(getImagePreviewPdfFilename(doc.filename));
    filenamesToDelete.add(`${path.parse(doc.filename).name}_scan.pdf`);
    filenamesToDelete.add(`${path.parse(doc.filename).name}_preview.pdf`);
    filenamesToDelete.add(`enhanced_${doc.filename}`);
  }

  filenamesToDelete.forEach((filename) => {
    deleteFile(path.resolve(uploadDir, filename));
  });

  // Delete all chunks/embeddings
  await DocumentChunkModel.deleteMany({ documentId: id });

  // Delete document record
  await DocumentModel.findByIdAndDelete(id);
};

export const renameDocument = async (id: string, ownerId: string, newName: string): Promise<IDocument> => {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  doc.originalName = newName;
  doc.updatedAt = new Date();
  await doc.save();
  return doc;
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

const ensureImagePreview = async (doc: IDocument): Promise<IDocument> => {
  if (!isImageMimeType(doc.mimeType)) return doc;

  const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const imagePath = path.resolve(uploadDir, doc.filename);
  const previewFilename = getImagePreviewPdfFilename(doc.filename);
  const previewPath = path.resolve(uploadDir, previewFilename);

  if (!fs.existsSync(imagePath)) return doc;

  const shouldGenerate =
    doc.ocrPdfPath !== previewFilename ||
    !fs.existsSync(previewPath) ||
    fs.statSync(imagePath).mtimeMs > fs.statSync(previewPath).mtimeMs;

  if (!shouldGenerate) return doc;

  try {
    await createImagePdfPreview(imagePath, previewPath);
    const updated = await DocumentModel.findByIdAndUpdate(
      doc._id,
      {
        ocrPdfPath: previewFilename,
        pageCount: 1,
      },
      { new: true }
    ).select('-__v').lean().exec();

    return (updated as unknown as IDocument) || {
      ...doc,
      ocrPdfPath: previewFilename,
      pageCount: 1,
    };
  } catch (error) {
    logger.warn(`Unable to refresh image PDF preview for ${doc.originalName}:`, error);
    return doc;
  }
};
