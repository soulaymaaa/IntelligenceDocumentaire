import { Response, NextFunction } from 'express';
import path from 'path';
import { z } from 'zod';
import * as documentService from './document.service';
import { logAction } from '../audit/audit.service';
import { asyncHandler, successResponse } from '../../utils/helpers';
import { ValidationError } from '../../utils/errors';
import { AuthRequest } from '../../middleware/authenticate';
import { env } from '../../config/env';
import { scheduleOcr } from '../ocr/ocr.queue';
import { logger } from '../../utils/logger';
import {
  createImagePdfPreview,
  getImagePreviewPdfFilename,
  isImageMimeType,
} from './pdf-preview.service';
import {
  decodeMulterFilename,
  detectStoredFileType,
  renameStoredFileToExtension,
} from '../../utils/file-inspection';

interface PreparedUploadFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
}

export const uploadDocuments = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) throw new ValidationError('No files uploaded');

  const uploadSchema = z.object({
    folderId: z.string().optional().transform((v) => v || undefined),
  });
  const parsedUpload = uploadSchema.safeParse(req.body);
  if (!parsedUpload.success) throw new ValidationError('Invalid upload parameters');

  const created = await Promise.all(
    files.map(async (file) => {
      const preparedFile = await prepareUploadedFile(file);
      const previewMetadata = await createPreviewMetadata(preparedFile);
      const doc = await documentService.createDocument({
        ownerId: req.userId!,
        folderId: parsedUpload.data.folderId,
        filename: preparedFile.filename,
        originalName: preparedFile.originalName,
        mimeType: preparedFile.mimeType,
        size: preparedFile.size,
        storagePath: preparedFile.storagePath,
        ...previewMetadata,
      });

      // Schedule OCR immediately
      await scheduleOcr(doc._id.toString());

      await logAction({
        userId: req.userId!,
        action: 'DOCUMENT_UPLOAD',
        resourceType: 'Document',
        resourceId: doc._id.toString(),
        metadata: { filename: preparedFile.originalName, size: preparedFile.size },
      });

      return doc;
    })
  );

  return successResponse(res, { documents: created }, `${created.length} document(s) uploaded`, 201);
});

const prepareUploadedFile = async (file: Express.Multer.File): Promise<PreparedUploadFile> => {
  const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  let filename = file.filename;
  let filePath = path.resolve(uploadDir, filename);
  const originalName = decodeMulterFilename(file.originalname);
  const detected = detectStoredFileType(filePath);
  const mimeType = detected?.mimeType || file.mimetype;

  if (detected) {
    const normalized = await renameStoredFileToExtension(filePath, filename, detected.extension);
    filename = normalized.filename;
    filePath = normalized.filePath;

    if (filename !== file.filename || mimeType !== file.mimetype) {
      logger.info(
        `Normalized upload ${originalName}: ${file.mimetype}/${file.filename} -> ${mimeType}/${filename}`
      );
    }
  }

  return {
    filename,
    originalName,
    mimeType,
    size: file.size,
    storagePath: path.join(env.UPLOAD_DIR, filename),
  };
};

const createPreviewMetadata = async (
  file: PreparedUploadFile
): Promise<{ ocrPdfPath?: string; pageCount?: number }> => {
  if (!isImageMimeType(file.mimeType)) return {};

  const previewPdfFilename = getImagePreviewPdfFilename(file.filename);
  const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const imagePath = path.resolve(uploadDir, file.filename);
  const previewPdfPath = path.resolve(uploadDir, previewPdfFilename);

  try {
    await createImagePdfPreview(imagePath, previewPdfPath);
    return { ocrPdfPath: previewPdfFilename, pageCount: 1 };
  } catch (error) {
    logger.warn(`Image PDF preview generation failed for ${file.originalName}:`, error);
    return {};
  }
};

export const listDocuments = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const pageSchema = z.object({
    page: z.string().optional().transform(v => v ? parseInt(v) : 1),
    limit: z.string().optional().transform(v => v ? Math.min(parseInt(v), 100) : 20),
    status: z.string().optional(),
    search: z.string().optional(),
    archived: z.string().optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
    folderId: z.string().optional().transform(v => v === 'unfiled' ? null : v),
    dossierId: z.string().optional(),
  });

  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) throw new ValidationError('Invalid query parameters');

  const result = await documentService.listDocuments({
    ownerId: req.userId!,
    ...parsed.data,
    status: parsed.data.status as any,
  });

  return successResponse(res, result);
});

export const listFolders = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const search = req.query.search as string | undefined;
  const result = await documentService.listFolders(req.userId!, search);
  return successResponse(res, result);
});

export const createFolder = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const schema = z.object({
    name: z.string().trim().min(1).max(120),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Invalid folder data');

  const folder = await documentService.createFolder({
    ownerId: req.userId!,
    ...parsed.data,
  });

  await logAction({
    userId: req.userId!,
    action: 'DOCUMENT_FOLDER_CREATE',
    resourceType: 'DocumentFolder',
    resourceId: folder._id.toString(),
    metadata: { name: folder.name },
  });

  return successResponse(res, { folder }, 'Folder created successfully', 201);
});

export const renameFolder = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const schema = z.object({
    name: z.string().trim().min(1).max(120),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Invalid folder data');

  const folder = await documentService.renameFolder(req.params.id, req.userId!, parsed.data);

  await logAction({
    userId: req.userId!,
    action: 'DOCUMENT_FOLDER_RENAME',
    resourceType: 'DocumentFolder',
    resourceId: folder._id.toString(),
    metadata: { name: folder.name },
  });

  return successResponse(res, { folder }, 'Folder updated successfully');
});

export const deleteFolder = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  await documentService.deleteFolder(req.params.id, req.userId!);

  await logAction({
    userId: req.userId!,
    action: 'DOCUMENT_FOLDER_DELETE',
    resourceType: 'DocumentFolder',
    resourceId: req.params.id,
  });

  return successResponse(res, null, 'Folder deleted successfully');
});

export const getDocument = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const doc = await documentService.getDocument(req.params.id, req.userId!);
  return successResponse(res, { document: doc });
});

export const deleteDocument = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  await documentService.deleteDocument(req.params.id, req.userId!);

  await logAction({
    userId: req.userId!,
    action: 'DOCUMENT_DELETE',
    resourceType: 'Document',
    resourceId: req.params.id,
  });

  return successResponse(res, null, 'Document deleted successfully');
});

export const archiveDocument = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const doc = await documentService.archiveDocument(req.params.id, req.userId!);

  await logAction({
    userId: req.userId!,
    action: 'DOCUMENT_ARCHIVE',
    resourceType: 'Document',
    resourceId: req.params.id,
  });

  return successResponse(res, { document: doc }, 'Document archived');
});

export const restoreDocument = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const doc = await documentService.restoreDocument(req.params.id, req.userId!);

  await logAction({
    userId: req.userId!,
    action: 'DOCUMENT_RESTORE',
    resourceType: 'Document',
    resourceId: req.params.id,
  });

  return successResponse(res, { document: doc }, 'Document restored');
});

export const renameDocument = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const schema = z.object({
    originalName: z.string().min(1).max(255),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Invalid document name');

  const doc = await documentService.renameDocument(req.params.id, req.userId!, parsed.data.originalName);

  await logAction({
    userId: req.userId!,
    action: 'DOCUMENT_RENAME',
    resourceType: 'Document',
    resourceId: req.params.id,
    metadata: { newName: parsed.data.originalName },
  });

  return successResponse(res, { document: doc }, 'Document renamed successfully');
});

export const moveDocumentToFolder = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const schema = z.object({
    folderId: z.preprocess(
      (v) => v === '' ? null : v,
      z.string().nullable().optional()
    ),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Invalid folder selection');

  const doc = await documentService.moveDocumentToFolder(req.params.id, req.userId!, parsed.data.folderId);

  await logAction({
    userId: req.userId!,
    action: 'DOCUMENT_MOVE_FOLDER',
    resourceType: 'Document',
    resourceId: req.params.id,
    metadata: { folderId: parsed.data.folderId || null },
  });

  return successResponse(res, { document: doc }, 'Document moved successfully');
});
export const runOcr = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  // Validate ownership first
  const doc = await documentService.getDocument(req.params.id, req.userId!);
  await scheduleOcr(doc._id.toString());

  await logAction({
    userId: req.userId!,
    action: 'OCR_TRIGGERED',
    resourceType: 'Document',
    resourceId: req.params.id,
  });

  return successResponse(res, null, 'OCR job scheduled');
});

export const reindexDocument = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const doc = await documentService.getDocument(req.params.id, req.userId!);
  await scheduleOcr(doc._id.toString());

  await logAction({
    userId: req.userId!,
    action: 'DOCUMENT_REINDEX',
    resourceType: 'Document',
    resourceId: req.params.id,
  });

  return successResponse(res, null, 'Re-indexing job scheduled');
});


export const getDashboard = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const stats = await documentService.getDashboardStats(req.userId!);
  return successResponse(res, stats);
});
