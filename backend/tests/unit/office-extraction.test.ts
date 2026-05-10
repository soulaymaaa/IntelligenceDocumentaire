import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { extractTextFromOffice } from '../../src/modules/ocr/ocr.service';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const tempRoot = path.resolve(__dirname, '..', '.tmp-office-extraction');

describe('Office extraction', () => {
  beforeEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    fs.mkdirSync(tempRoot, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('extracts readable rows from xlsx shared strings and numeric cells', async () => {
    const filePath = path.join(tempRoot, 'products.xlsx');
    const zip = new AdmZip();

    zip.addFile(
      'xl/workbook.xml',
      Buffer.from(
        '<workbook><sheets><sheet name="Products" sheetId="1" r:id="rId1"/></sheets></workbook>',
        'utf8'
      )
    );
    zip.addFile(
      'xl/sharedStrings.xml',
      Buffer.from(
        '<sst><si><t>Name</t></si><si><t>Price</t></si><si><t>Widget</t></si></sst>',
        'utf8'
      )
    );
    zip.addFile(
      'xl/worksheets/sheet1.xml',
      Buffer.from(
        [
          '<worksheet><sheetData>',
          '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>',
          '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>42</v></c></row>',
          '</sheetData></worksheet>',
        ].join(''),
        'utf8'
      )
    );
    zip.writeZip(filePath);

    const text = await extractTextFromOffice(filePath, XLSX_MIME_TYPE);

    expect(text).toContain('Products');
    expect(text).toContain('Name | Price');
    expect(text).toContain('Widget | 42');
  });
});
