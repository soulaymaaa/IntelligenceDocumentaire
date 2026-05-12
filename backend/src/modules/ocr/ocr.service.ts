import Tesseract from 'tesseract.js';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { DocumentModel } from '../documents/document.model';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { NotFoundError } from '../../utils/errors';

// ── Lazy-loaded PDF renderer (pdfjs-dist is ESM-only, loaded via dynamic import) ──

interface PdfRenderer {
  pdfjsLib: any;
  createCanvas: (w: number, h: number) => any;
}

let _renderer: PdfRenderer | null = null;
let _rendererLoading: Promise<PdfRenderer | null> | null = null;

// Use Function constructor to prevent TypeScript from compiling import() → require()
// This is the standard pattern for loading ESM modules from CJS TypeScript output.
const esmImport = new Function('m', 'return import(m)') as (m: string) => Promise<any>;

const getPdfRenderer = async (): Promise<PdfRenderer | null> => {
  if (_renderer) return _renderer;
  if (_rendererLoading) return _rendererLoading;

  _rendererLoading = (async () => {
    try {
      const pdfjsLib = await esmImport('pdfjs-dist/legacy/build/pdf.mjs');
      // Disable Web Worker — use fake worker for Node.js
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';

      // @napi-rs/canvas is a CJS module — direct require is fine
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createCanvas } = require('@napi-rs/canvas');

      _renderer = { pdfjsLib, createCanvas };
      logger.info('PDF renderer ready (pdfjs-dist v5 + @napi-rs/canvas)');
      return _renderer;
    } catch (err: any) {
      logger.error('PDF renderer failed to initialize — scanned PDFs will not be OCR\'d', {
        error: err.message,
      });
      return null;
    }
  })();

  return _rendererLoading;
};

// ── Public API ─────────────────────────────────────────────────────────────────

export const performOcr = async (documentId: string): Promise<string> => {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new NotFoundError('Document');

  const filePath = path.resolve(process.cwd(), env.UPLOAD_DIR, doc.filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  logger.info(`OCR start: "${doc.originalName}" (${doc.mimeType}, ${(doc.size / 1024).toFixed(1)} KB)`);

  let raw: string;

  if (doc.mimeType === 'application/pdf') {
    raw = await extractFromPdf(filePath, documentId);
  } else {
    raw = await extractFromImage(filePath);
  }

  const cleaned = cleanText(raw);
  logger.info(`OCR done: ${cleaned.length} chars, ~${wordCount(cleaned)} words`);
  return cleaned;
};

// ── PDF extraction ─────────────────────────────────────────────────────────────

const extractFromPdf = async (filePath: string, documentId: string): Promise<string> => {
  const buffer = fs.readFileSync(filePath);

  // Step 1: attempt native text extraction (fast, high quality)
  let pdfData: any = null;
  try {
    pdfData = await pdfParse(buffer);
  } catch (err: any) {
    logger.warn(`pdf-parse failed: ${err.message} — will attempt image OCR`);
  }

  const nativeText = pdfData?.text?.trim() ?? '';
  const numPages = pdfData?.numpages ?? 0;

  if (numPages > 0) {
    await DocumentModel.findByIdAndUpdate(documentId, { pageCount: numPages });
  }

  const wCount = wordCount(nativeText);
  const isSubstantial = wCount >= 30;

  if (isSubstantial) {
    logger.info(`Native PDF text: ${nativeText.length} chars / ${wCount} words / ${numPages} pages`);
    return nativeText;
  }

  // Step 2: scanned PDF — render each page as an image and OCR
  logger.info(`PDF has only ${wCount} words of native text — rendering pages for OCR`);
  const scannedText = await renderPdfPagesAndOcr(buffer);

  // Update page count from rendering if we didn't get it earlier
  if (!numPages && scannedText) {
    // page count is updated inside renderPdfPagesAndOcr
  }

  return scannedText || nativeText; // fallback to any native text if OCR also fails
};

const renderPdfPagesAndOcr = async (buffer: Buffer): Promise<string> => {
  const renderer = await getPdfRenderer();

  if (!renderer) {
    throw new Error(
      'Cannot OCR scanned PDF: PDF renderer not available. ' +
      'Ensure pdfjs-dist and @napi-rs/canvas are installed.'
    );
  }

  const { pdfjsLib, createCanvas } = renderer;

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const numPages: number = pdf.numPages;

  logger.info(`Rendering ${numPages} page(s) for OCR (scale 2×)`);

  // Provide a canvas factory so pdfjs uses @napi-rs/canvas
  const canvasFactory = {
    create: (w: number, h: number) => {
      const canvas = createCanvas(w, h);
      return { canvas, context: canvas.getContext('2d') };
    },
    reset: (cc: any, w: number, h: number) => {
      cc.canvas.width = w;
      cc.canvas.height = h;
    },
    destroy: (cc: any) => {
      cc.canvas.width = 0;
      cc.canvas.height = 0;
    },
  };

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    logger.info(`  Page ${pageNum}/${numPages}`);
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // 2× → ~150 DPI → decent OCR quality

      const { canvas, context } = canvasFactory.create(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height)
      );

      await page.render({ canvasContext: context, viewport, canvasFactory }).promise;

      // Convert canvas to PNG buffer
      const pngBuffer: Buffer = canvas.toBuffer('image/png');

      // Preprocess for better Tesseract accuracy
      const processed = await preprocessImageBuffer(pngBuffer);

      const text = await ocrBuffer(processed);
      if (text.trim()) pageTexts.push(text.trim());

      // Free memory
      canvasFactory.destroy({ canvas });
      page.cleanup();
    } catch (pageErr: any) {
      logger.warn(`  Page ${pageNum} failed: ${pageErr.message}`);
    }
  }

  const combined = pageTexts.join('\n\n');
  logger.info(`Scanned PDF OCR: ${combined.length} chars from ${numPages} page(s)`);
  return combined;
};

// ── Image extraction ───────────────────────────────────────────────────────────

const extractFromImage = async (filePath: string): Promise<string> => {
  logger.info('Preprocessing image with sharp before OCR');
  let processed: Buffer;

  try {
    processed = await preprocessImageFile(filePath);
  } catch (err: any) {
    logger.warn(`sharp preprocessing failed (${err.message}), using raw file`);
    processed = fs.readFileSync(filePath);
  }

  return ocrBuffer(processed);
};

// ── Image preprocessing ────────────────────────────────────────────────────────

/**
 * Preprocess a file-based image for better OCR accuracy:
 * 1. Upscale to at least 2400px wide (OCR needs resolution)
 * 2. Greyscale (reduces noise)
 * 3. Sharpen text edges
 * 4. Normalise contrast
 */
const preprocessImageFile = async (filePath: string): Promise<Buffer> => {
  const meta = await sharp(filePath).metadata();
  const width = meta.width ?? 0;

  return sharp(filePath)
    .resize(
      width < 2000 ? { width: 2400, withoutEnlargement: false } : undefined
    )
    .greyscale()
    .sharpen({ sigma: 1.0, m1: 0.5, m2: 3.0 })
    .normalise()
    .png()
    .toBuffer();
};

/**
 * Preprocess an in-memory PNG buffer (used for PDF pages rendered to canvas).
 */
const preprocessImageBuffer = async (pngBuffer: Buffer): Promise<Buffer> => {
  return sharp(pngBuffer)
    .greyscale()
    .sharpen({ sigma: 1.0, m1: 0.5, m2: 3.0 })
    .normalise()
    .png()
    .toBuffer();
};

// ── Tesseract OCR ──────────────────────────────────────────────────────────────

const ocrBuffer = async (input: Buffer | string): Promise<string> => {
  const result = await Tesseract.recognize(input, env.OCR_LANGUAGES, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        const pct = Math.round(m.progress * 100);
        if (pct % 25 === 0) logger.debug(`  Tesseract: ${pct}%`);
      }
    },
  });

  const words = result.data.words ?? [];
  const CONFIDENCE_THRESHOLD = 35; // 0–100; words below this are noise

  // Use per-line reconstruction only when we have enough high-confidence words
  if (words.length > 0) {
    const goodWords = words.filter((w: any) => w.confidence >= CONFIDENCE_THRESHOLD);
    const ratio = goodWords.length / words.length;

    if (ratio >= 0.5 && result.data.lines && result.data.lines.length > 0) {
      const reconstructed = result.data.lines
        .map((line: any) =>
          (line.words as any[])
            .filter((w) => w.confidence >= CONFIDENCE_THRESHOLD)
            .map((w) => w.text)
            .join(' ')
        )
        .filter((l: string) => l.trim().length > 0)
        .join('\n');

      if (reconstructed.length > 0) {
        logger.debug(`Tesseract: ${goodWords.length}/${words.length} words ≥ ${CONFIDENCE_THRESHOLD}% confidence`);
        return reconstructed;
      }
    } else {
      logger.warn(`Low OCR confidence: only ${Math.round(ratio * 100)}% words above threshold`);
    }
  }

  return result.data.text?.trim() ?? '';
};

// ── Text cleaning ──────────────────────────────────────────────────────────────

/**
 * Normalise extracted text for clean embedding input:
 * - Unify line endings
 * - Rejoin words split by end-of-line hyphenation
 * - Collapse excess whitespace / blank lines
 * - Remove common OCR artefacts and control characters
 */
export const cleanText = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Fix hyphenated line breaks: "connec-\ntion" → "connection"
    .replace(/(\w)-\n(\w)/g, '$1$2')
    // Collapse multiple spaces to one
    .replace(/ {2,}/g, ' ')
    // Trim trailing spaces on each line
    .replace(/ +$/gm, '')
    // Max 2 consecutive blank lines (preserve paragraph structure)
    .replace(/\n{3,}/g, '\n\n')
    // Remove lines that are just page numbers
    .replace(/^\s*\d{1,3}\s*$/gm, '')
    // Remove null bytes and non-printable control characters (except \n and \t)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const wordCount = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length;
