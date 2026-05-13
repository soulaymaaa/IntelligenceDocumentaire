import { DocumentModel, IDocument, DocumentStatus } from './document.model';
import { DocumentFolderModel, IDocumentFolder } from './document-folder.model';
import { DocumentChunkModel } from '../embeddings/chunk.model';
import { deleteFile } from '../uploads/upload.middleware';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../../utils/errors';
import { paginationMeta } from '../../utils/helpers';
import { Types } from 'mongoose';
import path from 'path';
import fs from 'fs';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  createImagePdfPreview,
  getImagePreviewPdfFilename,
  isImageMimeType,
} from './pdf-preview.service';
import { normalizeDocumentStoredFile } from './document-file.service';

interface ListDocumentsParams {
  ownerId: string;
  page?: number;
  limit?: number;
  status?: DocumentStatus;
  search?: string;
  archived?: boolean;
<<<<<<< HEAD
  folderId?: string | null;
}

interface FolderLeanItem {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FolderListItem extends FolderLeanItem {
  documentCount: number;
}

interface ListFoldersResult {
  folders: FolderListItem[];
  unfiledCount: number;
  documents?: IDocument[];
}

export const listDocuments = async (params: ListDocumentsParams) => {
  const { ownerId, page = 1, limit = 20, status, search, archived, folderId } = params;
=======
  dossierId?: string;
}

export const listDocuments = async (params: ListDocumentsParams) => {
  const { ownerId, page = 1, limit = 20, status, search, archived, dossierId } = params;
>>>>>>> 8cc1307b0c4b1c4690e57af12a159aa6776fc8cd

  const query: any = { ownerId };
  if (status) query.status = status;
  if (typeof archived === 'boolean') query.archived = archived;
  if (search) query.originalName = { $regex: search, $options: 'i' };
<<<<<<< HEAD
  if (folderId !== undefined) {
    if (folderId === null) {
      query.$or = [{ folderId: null }, { folderId: { $exists: false } }];
    } else {
      await getFolderById(folderId, ownerId);
      query.folderId = folderId;
    }
  }
=======
  if (dossierId) query.dossierId = dossierId;
>>>>>>> 8cc1307b0c4b1c4690e57af12a159aa6776fc8cd

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

export const listFolders = async (ownerId: string, search?: string): Promise<ListFoldersResult> => {
  const folderQuery: any = { ownerId };
  let matchingDocuments: IDocument[] | undefined;

  if (search) {
    const matchingFolders = await DocumentFolderModel.find({
      ownerId,
      name: { $regex: search, $options: 'i' }
    }).select('_id').lean();
    
    const matchingFolderIds = matchingFolders.map(f => f._id.toString());
    
    const docsWithMatch = await DocumentModel.find({
      ownerId,
      originalName: { $regex: search, $options: 'i' },
      folderId: { $ne: null }
    }).select('-__v').lean();
    
    matchingDocuments = docsWithMatch as unknown as IDocument[];
    const folderIdsFromDocs = docsWithMatch
      .filter(d => d.folderId)
      .map(d => d.folderId!.toString());
      
    const combinedIds = Array.from(new Set([...matchingFolderIds, ...folderIdsFromDocs]));
    folderQuery._id = { $in: combinedIds };
  }

  const folders = await DocumentFolderModel.find(folderQuery)
    .sort({ name: 1 })
    .select('-__v')
    .lean()
    .exec() as unknown as FolderLeanItem[];

  const ownerObjectId = new Types.ObjectId(ownerId);
  const [folderCounts, unfiledCount] = await Promise.all([
    DocumentModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      {
        $match: {
          ownerId: ownerObjectId,
          archived: false,
          folderId: { $ne: null },
        },
      },
      { $group: { _id: '$folderId', count: { $sum: 1 } } },
    ]),
    DocumentModel.countDocuments({
      ownerId,
      archived: false,
      $or: [{ folderId: null }, { folderId: { $exists: false } }],
      ...(search ? { originalName: { $regex: search, $options: 'i' } } : {}),
    }),
  ]);

  const countsByFolderId = new Map<string, number>(
    folderCounts.map((item) => [item._id.toString(), item.count])
  );

  return {
    folders: folders.map((folder) => ({
      ...folder,
      documentCount: countsByFolderId.get(folder._id.toString()) || 0,
    })),
    unfiledCount,
    documents: matchingDocuments,
  };
};

export const createFolder = async (data: {
  ownerId: string;
  name: string;
  color?: string;
}): Promise<IDocumentFolder> => {
  const name = normalizeFolderName(data.name);
  await ensureFolderNameAvailable(data.ownerId, name);

  return DocumentFolderModel.create({
    ownerId: data.ownerId,
    name,
    color: data.color,
  });
};

export const renameFolder = async (
  id: string,
  ownerId: string,
  data: { name: string; color?: string }
): Promise<IDocumentFolder> => {
  const folder = await getFolderById(id, ownerId);
  const name = normalizeFolderName(data.name);
  await ensureFolderNameAvailable(ownerId, name, id);

  folder.name = name;
  if (data.color) folder.color = data.color;
  await folder.save();
  return folder;
};

export const deleteFolder = async (id: string, ownerId: string): Promise<void> => {
  const folder = await getFolderById(id, ownerId);

  await DocumentModel.updateMany(
    { ownerId, folderId: folder._id },
    { $unset: { folderId: '' }, $set: { updatedAt: new Date() } }
  );
  await folder.deleteOne();
};

export const getDocument = async (id: string, ownerId: string): Promise<IDocument> => {
  const doc = await DocumentModel.findById(id).select('-__v').lean().exec();
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();
  const normalized = await normalizeDocumentStoredFile(doc as unknown as IDocument);
  return ensureImagePreview(normalized.doc as unknown as IDocument);
};

export const createDocument = async (data: {
  ownerId: string;
  folderId?: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  ocrPdfPath?: string;
  pageCount?: number;
}): Promise<IDocument> => {
  const { folderId, ...documentData } = data;
  const folder = folderId ? await getFolderById(folderId, data.ownerId) : null;

  const doc = await DocumentModel.create({
    ...documentData,
    folderId: folder?._id || null,
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

<<<<<<< HEAD
export const renameDocument = async (id: string, ownerId: string, newName: string): Promise<IDocument> => {
=======
export const moveDocument = async (id: string, ownerId: string, dossierId: string | null): Promise<IDocument> => {
>>>>>>> 8cc1307b0c4b1c4690e57af12a159aa6776fc8cd
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

<<<<<<< HEAD
  doc.originalName = newName;
  doc.updatedAt = new Date();
  await doc.save();
  return doc;
};

export const moveDocumentToFolder = async (
  id: string,
  ownerId: string,
  folderId?: string | null
): Promise<IDocument> => {
  const doc = await DocumentModel.findById(id);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  const folder = folderId ? await getFolderById(folderId, ownerId) : null;
  doc.folderId = folder?._id || null;
  doc.updatedAt = new Date();
=======
  if (dossierId) {
    (doc as any).dossierId = dossierId;
  } else {
    (doc as any).dossierId = undefined;
    await DocumentModel.findByIdAndUpdate(id, { $unset: { dossierId: 1 } });
    return doc;
  }
>>>>>>> 8cc1307b0c4b1c4690e57af12a159aa6776fc8cd
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

const getFolderById = async (id: string, ownerId: string): Promise<IDocumentFolder> => {
  if (!Types.ObjectId.isValid(id)) throw new ValidationError('Invalid folder id');

  const folder = await DocumentFolderModel.findOne({ _id: id, ownerId });
  if (!folder) throw new NotFoundError('Folder');
  return folder;
};

const normalizeFolderName = (name: string): string => {
  const normalized = name.trim();
  if (!normalized) throw new ValidationError('Folder name is required');
  return normalized;
};

const ensureFolderNameAvailable = async (
  ownerId: string,
  name: string,
  currentFolderId?: string
) => {
  const duplicate = await DocumentFolderModel.findOne({
    ownerId,
    name: { $regex: `^${escapeRegExp(name)}$`, $options: 'i' },
  });

  if (duplicate && duplicate._id.toString() !== currentFolderId) {
    throw new ConflictError('A folder with this name already exists');
  }
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
