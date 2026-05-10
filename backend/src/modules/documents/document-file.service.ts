import fs from 'fs';
import path from 'path';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { DocumentModel } from './document.model';
import {
  decodeMulterFilename,
  detectStoredFileType,
  renameStoredFileToExtension,
} from '../../utils/file-inspection';

interface StoredDocumentFile {
  _id: Types.ObjectId | string;
  filename: string;
  originalName?: string;
  mimeType: string;
  storagePath: string;
}

export const normalizeDocumentStoredFile = async <T extends StoredDocumentFile>(
  doc: T
): Promise<{ doc: T; filePath: string }> => {
  const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  let filePath = path.resolve(uploadDir, doc.filename);

  if (!fs.existsSync(filePath)) return { doc, filePath };

  const detected = detectStoredFileType(filePath);
  const updates: Partial<StoredDocumentFile> = {};
  const decodedOriginalName = doc.originalName ? decodeMulterFilename(doc.originalName) : undefined;

  if (decodedOriginalName && decodedOriginalName !== doc.originalName) {
    updates.originalName = decodedOriginalName;
  }

  if (!detected) {
    if (Object.keys(updates).length > 0) {
      await persistDocumentFileUpdates(doc, updates);
    }
    return { doc, filePath };
  }

  if (detected.mimeType !== doc.mimeType) {
    updates.mimeType = detected.mimeType;
  }

  const normalizedFile = await renameStoredFileToExtension(filePath, doc.filename, detected.extension);
  if (normalizedFile.filename !== doc.filename) {
    updates.filename = normalizedFile.filename;
    updates.storagePath = path.join(env.UPLOAD_DIR, normalizedFile.filename);
    filePath = normalizedFile.filePath;
  }

  if (Object.keys(updates).length > 0) {
    await persistDocumentFileUpdates(doc, updates);
  }

  return { doc, filePath };
};

const persistDocumentFileUpdates = async <T extends StoredDocumentFile>(
  doc: T,
  updates: Partial<StoredDocumentFile>
): Promise<void> => {
  await DocumentModel.findByIdAndUpdate(doc._id, {
    ...updates,
    updatedAt: new Date(),
  });
  Object.assign(doc, updates);
  logger.info(`Normalized stored file metadata for document ${doc._id}: ${JSON.stringify(updates)}`);
};
