import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import {
  decodeMulterFilename,
  detectStoredFileType,
} from '../../src/utils/file-inspection';

const tempRoot = path.resolve(__dirname, '..', '.tmp-file-inspection');

describe('file inspection helpers', () => {
  beforeEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.mkdirSync(tempRoot, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('decodes multer filenames that were interpreted as latin1', () => {
    const expected = `pr${String.fromCharCode(0xe9)}sentation.pptx`;
    const mojibake = Buffer.from(expected, 'utf8').toString('latin1');

    expect(decodeMulterFilename(mojibake)).toBe(expected);
  });

  it('detects a PDF even when the stored extension is pptx', () => {
    const filePath = path.join(tempRoot, 'sample.pptx');
    fs.writeFileSync(filePath, Buffer.from('%PDF-1.7\n1 0 obj\n'));

    expect(detectStoredFileType(filePath)).toEqual({
      mimeType: 'application/pdf',
      extension: '.pdf',
    });
  });

  it('detects pptx files from the OOXML package contents', () => {
    const filePath = path.join(tempRoot, 'sample.bin');
    const zip = new AdmZip();
    zip.addFile('ppt/presentation.xml', Buffer.from('<p:presentation />'));
    zip.writeZip(filePath);

    expect(detectStoredFileType(filePath)).toEqual({
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      extension: '.pptx',
    });
  });
});
