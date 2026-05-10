import path from 'path';
import fs from 'fs';
import { extractTextFromOffice } from '../src/modules/ocr/ocr.service';
import PDFDocument from 'pdfkit-table';
import { env } from '../src/config/env';

// Mock env
env.UPLOAD_DIR = 'uploads';

const testPdf = async () => {
  const isSpreadsheetXlsx = (mimeType: string) => mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  const text = `Sheet1
N° | Nom du produit | Lien | Description | Image | Prix
1 | Produit A | http://a.com | Desc A | | 10
2 | Produit B | http://b.com | Desc B | | 20`;

  const outputFilename = 'test-preview.pdf';
  const outputPath = path.resolve(process.cwd(), outputFilename);
  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
  const stream = fs.createWriteStream(outputPath);
  
  doc.pipe(stream);
  
  const sheets = text.split('\n\n');
  for (const sheet of sheets) {
    const lines = sheet.split('\n');
    if (lines.length > 0) {
      const sheetTitle = lines[0];
      const rows = lines.slice(1).map(line => line.split(' | '));
      
      if (rows.length > 0) {
        const maxCols = Math.max(...rows.map(r => r.length));
        const headers = rows[0].map(h => String(h || ' '));
        while (headers.length < maxCols) headers.push(' ');
        
        const tableRows = rows.slice(1).map(row => {
          const paddedRow = row.map(c => String(c || ' '));
          while (paddedRow.length < maxCols) paddedRow.push(' ');
          return paddedRow;
        });
        
        const colMaxLengths = headers.map((h, i) => {
          let max = h.length;
          for (const row of tableRows) {
            if (row[i] && row[i].length > max) {
              max = row[i].length;
            }
          }
          return Math.min(max, 150);
        });
        const totalLength = colMaxLengths.reduce((a, b) => a + b, 0) || 1;
        const usableWidth = 841.89 - 60;
        
        const headersWithWidths = headers.map((h, i) => {
          const proportion = colMaxLengths[i] / totalLength;
          const width = Math.max(40, proportion * usableWidth);
          return { label: h, property: \`col\${i}\`, width };
        });

        const mappedRows = tableRows.map(row => {
          const obj: Record<string, string> = {};
          row.forEach((cell, i) => {
            obj[\`col\${i}\`] = cell;
          });
          return obj;
        });

        const table = {
          title: sheetTitle,
          headers: headersWithWidths,
          rows: mappedRows.length > 0 ? mappedRows : [{}],
        };
        
        await doc.table(table, {
          prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
          prepareRow: () => doc.font("Helvetica").fontSize(8),
        });
      }
    }
  }
  
  doc.end();
  
  await new Promise((resolve) => stream.on('finish', resolve));
  console.log('PDF generated successfully');
};

testPdf().catch(console.error);
