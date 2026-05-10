import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export interface DetectedFileType {
  mimeType: string;
  extension: string;
}

const MIME_TO_EXTENSION: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/msword': '.doc',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.ms-powerpoint': '.ppt',
  'text/plain': '.txt',
};

const MOJIBAKE_PATTERN = /(?:Ã.|Â.|â[^\s]?)/;

export const extensionForMimeType = (mimeType: string): string | undefined => {
  return MIME_TO_EXTENSION[mimeType];
};

export const decodeMulterFilename = (filename: string): string => {
  if (!MOJIBAKE_PATTERN.test(filename)) return filename;

  const decoded = Buffer.from(filename, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? filename : decoded;
};

export const detectStoredFileType = (filePath: string): DetectedFileType | undefined => {
  const header = readHeader(filePath, 16);

  if (header.subarray(0, 5).toString('ascii') === '%PDF-') {
    return { mimeType: 'application/pdf', extension: '.pdf' };
  }

  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: '.jpg' };
  }

  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: '.png' };
  }

  if (isZipHeader(header)) {
    return detectOoxmlType(filePath);
  }

  return undefined;
};

export const renameStoredFileToExtension = async (
  filePath: string,
  filename: string,
  extension: string
): Promise<{ filename: string; filePath: string }> => {
  const currentExtension = path.extname(filename).toLowerCase();
  if (currentExtension === extension) return { filename, filePath };

  const nextFilename = `${path.parse(filename).name}${extension}`;
  const nextPath = path.resolve(path.dirname(filePath), nextFilename);

  if (fs.existsSync(nextPath)) {
    throw new Error(`Cannot normalize upload extension because ${nextFilename} already exists`);
  }

  await fs.promises.rename(filePath, nextPath);
  return { filename: nextFilename, filePath: nextPath };
};

const readHeader = (filePath: string, length: number): Buffer => {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const bytesRead = fs.readSync(fd, buffer, 0, length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
};

const isZipHeader = (header: Buffer): boolean => {
  return (
    header.length >= 4 &&
    header[0] === 0x50 &&
    header[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(header[2]) &&
    [0x04, 0x06, 0x08].includes(header[3])
  );
};

const detectOoxmlType = (filePath: string): DetectedFileType | undefined => {
  try {
    const zip = new AdmZip(filePath);
    const entries = new Set(zip.getEntries().map((entry) => entry.entryName));

    if (entries.has('word/document.xml')) {
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: '.docx',
      };
    }

    if (entries.has('xl/workbook.xml')) {
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: '.xlsx',
      };
    }

    if (entries.has('ppt/presentation.xml')) {
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        extension: '.pptx',
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
};
