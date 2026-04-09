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

export const uploadDocuments = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) throw new ValidationError('No files uploaded');

  const created = await Promise.all(
    files.map(async (file) => {
      const doc = await documentService.createDocument({
        ownerId: req.userId!,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storagePath: path.join(env.UPLOAD_DIR, file.filename),
      });

      // Schedule OCR immediately
      await scheduleOcr(doc._id.toString());

      await logAction({
        userId: req.userId!,
        action: 'DOCUMENT_UPLOAD',
        resourceType: 'Document',
        resourceId: doc._id.toString(),
        metadata: { filename: file.originalname, size: file.size },
      });

      return doc;
    })
  );

  return successResponse(res, { documents: created }, `${created.length} document(s) uploaded`, 201);
});

export const listDocuments = asyncHandler(async (req: AuthRequest, res: Response, _next: NextFunction) => {
  const pageSchema = z.object({
    page: z.string().optional().transform(v => v ? parseInt(v) : 1),
    limit: z.string().optional().transform(v => v ? Math.min(parseInt(v), 100) : 20),
    status: z.string().optional(),
    search: z.string().optional(),
    archived: z.string().optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
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
