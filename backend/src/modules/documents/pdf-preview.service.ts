import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { logger } from '../../utils/logger';

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PAGE_MARGIN_PT = 18;
const MAX_IMAGE_SIDE_PX = 2400;
const ANALYSIS_WIDTH_PX = 900;

interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
  polygon?: Point[];
}

interface Point {
  x: number;
  y: number;
}

interface ComponentBounds {
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  rows: Array<{ y: number; minX: number; maxX: number }>;
}

export const isImageMimeType = (mimeType: string): boolean => mimeType.startsWith('image/');

export const getImagePreviewPdfFilename = (filename: string): string => {
  return `${path.parse(filename).name}_clean.pdf`;
};

export const createImagePdfPreview = async (
  imagePath: string,
  pdfPath: string
): Promise<void> => {
  try {
    // 1. Initial load to get metadata and orientation
    const metadata = await sharp(imagePath).rotate().metadata();
    const originalWidth = metadata.width || 1;
    const originalHeight = metadata.height || 1;

    logger.info(`Processing image for PDF preview: ${path.basename(imagePath)} (${originalWidth}x${originalHeight})`);

    // 2. Detect deskew angle and potential crop
    const analysis = await detectDocumentCrop(imagePath);
    
    let pipeline = sharp(imagePath).rotate();

    // 3. Deskew if an angle was detected
    if (analysis?.angle) {
      logger.info(`Applying deskew angle: ${analysis.angle.toFixed(2)}°`);
      pipeline = pipeline.rotate(analysis.angle, { background: '#ffffff' });
    }

    // 4. Extract document area if possible
    if (analysis) {
      const finalMetadata = await pipeline.metadata();
      const currentWidth = finalMetadata.width || originalWidth;
      const currentHeight = finalMetadata.height || originalHeight;

      const left = Math.max(0, Math.min(currentWidth - 10, analysis.left));
      const top = Math.max(0, Math.min(currentHeight - 10, analysis.top));
      const width = Math.max(10, Math.min(currentWidth - left, analysis.width));
      const height = Math.max(10, Math.min(currentHeight - top, analysis.height));

      logger.info(`Extracting document area: ${width}x${height} at ${left},${top}`);
      pipeline = pipeline.extract({ left, top, width, height });
    }

    // 5. Magic Color Scan Effect (Professional Scan look)
    // We use a robust pipeline: normalization + brightness/contrast + sharpening
    const { data, info } = await pipeline
      .resize({
        width: MAX_IMAGE_SIDE_PX,
        height: MAX_IMAGE_SIDE_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .toColorspace('srgb')
      .normalize() // Autolevel contrast
      .modulate({ 
        brightness: 1.08,
      })
      .linear(1.3, -18) // Heavy contrast to whiten background and darken text
      .sharpen({ sigma: 1.2, m1: 2, m2: 20 })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    const width = info.width || 1;
    const height = info.height || 1;
    const pdf = createSinglePageImagePdf(data, width, height);

    await fs.promises.writeFile(pdfPath, pdf);
    logger.info(`Successfully generated scanned PDF preview: ${path.basename(pdfPath)}`);
  } catch (error) {
    logger.error(`Critical failure in document scan generation: ${error instanceof Error ? error.message : String(error)}`);
    
    // Final fallback: just convert original image to PDF without processing
    // to ensure the user at least sees something.
    try {
      const fallback = await sharp(imagePath).rotate().resize(1200, 1200, { fit: 'inside' }).jpeg().toBuffer({ resolveWithObject: true });
      const pdf = createSinglePageImagePdf(fallback.data, fallback.info.width!, fallback.info.height!);
      await fs.promises.writeFile(pdfPath, pdf);
      logger.warn(`Generated fallback PDF preview for: ${path.basename(imagePath)}`);
    } catch (fallbackError) {
      logger.error('Total failure: even fallback PDF generation failed.');
      throw error;
    }
  }
};

interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
  angle?: number;
  polygon?: Point[];
}

const detectDocumentCrop = async (imagePath: string): Promise<CropBox | null> => {
  const metadata = await sharp(imagePath).rotate().metadata();
  const originalWidth = metadata.width || 0;
  const originalHeight = metadata.height || 0;

  if (!originalWidth || !originalHeight) return null;

  // Use a smaller version for analysis to stay fast
  const { data, info } = await sharp(imagePath)
    .rotate()
    .resize({ width: Math.min(ANALYSIS_WIDTH_PX, originalWidth), withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;
  
  // 1. Find the largest bright component (the paper)
  const paperComponent = findPaperComponent(data, width, height, channels);

  if (!paperComponent) return null;

  // 2. Calculate orientation (Deskew angle)
  // We look at the top/bottom edges of the component to find the tilt
  const angle = calculateDeskewAngle(paperComponent, width, height, data, channels);

  // 3. Calculate crop bounds
  // If tilted, we need to be careful with the bounding box
  return scaleAndDeskewCrop(paperComponent, angle, originalWidth, originalHeight, width, height);
};

const calculateDeskewAngle = (component: ComponentBounds, width: number, height: number, data: Buffer, channels: number): number => {
  const rows = component.rows;
  if (rows.length < 50) return 0;

  // Projection-based deskewing (very robust for text-heavy documents)
  // We test angles and find the one that maximizes row variance (alignment of text lines)
  let bestAngle = 0;
  let maxVariance = -1;

  // We only check a subset of rows to stay fast
  const sampleRows = rows.filter((_, i) => i % 3 === 0);
  
  for (let angle = -20; angle <= 20; angle += 1) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Simple projection: sum of "brightness" along rotated rows
    const projection = new Float32Array(height);
    for (const row of sampleRows) {
      const x = (row.minX + row.maxX) / 2;
      const y = row.y;
      // Rotated Y coordinate
      const ry = Math.round(-x * sin + y * cos);
      if (ry >= 0 && ry < height) {
        projection[ry] += 1;
      }
    }

    // Calculate variance of projection
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let i = 0; i < height; i++) {
      if (projection[i] > 0) {
        sum += projection[i];
        sumSq += projection[i] * projection[i];
        count++;
      }
    }
    const variance = (sumSq / count) - (sum / count) ** 2;
    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = angle;
    }
  }

  return bestAngle;
};

const scaleAndDeskewCrop = (
  component: ComponentBounds,
  angle: number,
  originalWidth: number,
  originalHeight: number,
  analysisWidth: number,
  analysisHeight: number
): CropBox => {
  const scaleX = originalWidth / analysisWidth;
  const scaleY = originalHeight / analysisHeight;

  // Find 4 corners of the component to be more precise than a bounding box
  // NW = min(x+y), NE = max(x-y), SE = max(x+y), SW = min(x-y)
  let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
  let nw = { x: component.minX, y: component.minY };
  let ne = { x: component.maxX, y: component.minY };
  let se = { x: component.maxX, y: component.maxY };
  let sw = { x: component.minX, y: component.maxY };

  for (const row of component.rows) {
    const points = [{ x: row.minX, y: row.y }, { x: row.maxX, y: row.y }];
    for (const p of points) {
      if (p.x + p.y < minSum) { minSum = p.x + p.y; nw = p; }
      if (p.x + p.y > maxSum) { maxSum = p.x + p.y; se = p; }
      if (p.x - p.y < minDiff) { minDiff = p.x - p.y; sw = p; }
      if (p.x - p.y > maxDiff) { maxDiff = p.x - p.y; ne = p; }
    }
  }

  // Use the corners to define a slightly tighter crop
  const left = Math.min(nw.x, sw.x);
  const top = Math.min(nw.y, ne.y);
  const right = Math.max(ne.x, se.x);
  const bottom = Math.max(sw.y, se.y);

  // Add a very small padding (1%)
  const pad = Math.round(analysisWidth * 0.01);

  return {
    left: Math.max(0, Math.round((left + pad) * scaleX)),
    top: Math.max(0, Math.round((top + pad) * scaleY)),
    width: Math.min(originalWidth, Math.round((right - left - 2 * pad) * scaleX)),
    height: Math.min(originalHeight, Math.round((bottom - top - 2 * pad) * scaleY)),
    angle: angle,
  };
};

const findPaperComponent = (
  data: Buffer,
  width: number,
  height: number,
  channels: number
): ComponentBounds | null => {
  const size = width * height;
  const mask = new Uint8Array(size);
  const seen = new Uint8Array(size);
  const queue = new Int32Array(size);
  let best: ComponentBounds | null = null;

  for (let index = 0; index < size; index += 1) {
    const x = index % width;
    const y = Math.floor(index / width);
    mask[index] = isPaperPixel(data, width, channels, x, y) ? 1 : 0;
  }

  for (let index = 0; index < size; index += 1) {
    if (!mask[index] || seen[index]) continue;

    let start = 0;
    let end = 0;
    let area = 0;
    let minX = index % width;
    let maxX = minX;
    let minY = Math.floor(index / width);
    let maxY = minY;
    const rowMap = new Map<number, { minX: number; maxX: number }>();

    seen[index] = 1;
    queue[end] = index;
    end += 1;

    const addNeighbor = (neighbor: number, x: number, y: number): void => {
      if (neighbor < 0 || neighbor >= size) return;

      const nx = neighbor % width;
      const ny = Math.floor(neighbor / width);
      if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) return;
      if (!mask[neighbor] || seen[neighbor]) return;

      seen[neighbor] = 1;
      queue[end] = neighbor;
      end += 1;
    };

    while (start < end) {
      const current = queue[start];
      start += 1;

      const x = current % width;
      const y = Math.floor(current / width);
      area += 1;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const row = rowMap.get(y);
      if (row) {
        row.minX = Math.min(row.minX, x);
        row.maxX = Math.max(row.maxX, x);
      } else {
        rowMap.set(y, { minX: x, maxX: x });
      }

      addNeighbor(current + 1, x, y);
      addNeighbor(current - 1, x, y);
      addNeighbor(current + width, x, y);
      addNeighbor(current - width, x, y);
    }

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    const looksLikePage =
      area > size * 0.08 &&
      componentWidth > width * 0.35 &&
      componentHeight > height * 0.35;

    if (looksLikePage && (!best || area > best.area)) {
      const rows = [...rowMap.entries()]
        .map(([y, row]) => ({ y, minX: row.minX, maxX: row.maxX }))
        .sort((a, b) => a.y - b.y);
      best = { area, minX, maxX, minY, maxY, rows };
    }
  }

  return best;
};

const scaleComponentCrop = (
  component: ComponentBounds,
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  originalWidth: number,
  originalHeight: number
): CropBox | null => {
  const rowBounds = component.rows;
  const maxRowWidth = Math.max(...rowBounds.map((row) => row.maxX - row.minX + 1), 1);
  const validRows = rowBounds.filter((row) => row.maxX - row.minX + 1 > maxRowWidth * 0.45);

  if (validRows.length < height * 0.25) return null;

  const topY = validRows[0].y;
  const bottomY = validRows[validRows.length - 1].y;
  const windowSize = Math.max(10, Math.round((bottomY - topY) * 0.035));
  const topRows = validRows.filter((row) => row.y >= topY && row.y <= topY + windowSize);
  const bottomRows = validRows.filter((row) => row.y >= bottomY - windowSize && row.y <= bottomY);
  const contour = [
    { x: percentile(topRows.map((row) => row.minX), 0.75), y: topY },
    { x: percentile(topRows.map((row) => row.maxX), 0.75), y: topY },
    { x: percentile(bottomRows.map((row) => row.maxX), 0.75), y: bottomY },
    { x: percentile(bottomRows.map((row) => row.minX), 0.85), y: bottomY },
  ];
  const xs = contour.map((point) => point.x);
  const ys = contour.map((point) => point.y);
  const padX = Math.round(width * 0.003);
  const padY = Math.round(height * 0.006);
  const detectedLeft = Math.max(0, Math.floor(Math.min(...xs) - padX));
  const right = Math.min(width, Math.ceil(Math.max(...xs) + padX));
  const top = Math.max(0, Math.floor(Math.min(...ys) - padY));
  const detectedBottom = Math.min(height, Math.ceil(Math.max(...ys) + padY));
  const left = Math.min(right - 1, detectedLeft + Math.round((right - detectedLeft) * 0.006));
  const bottom = Math.max(top + 1, detectedBottom - Math.round((detectedBottom - top) * 0.006));

  if (right - left < width * 0.35 || bottom - top < height * 0.35) return null;

  const scaleX = originalWidth / width;
  const scaleY = originalHeight / height;
  const scaledLeft = Math.max(0, Math.round(left * scaleX));
  const scaledTop = Math.max(0, Math.round(top * scaleY));
  const scaledRight = Math.min(originalWidth, Math.round(right * scaleX));
  const scaledBottom = Math.min(originalHeight, Math.round(bottom * scaleY));

  const toRelativePoint = (point: Point): Point => ({
    x: Math.max(0, Math.min(scaledRight - scaledLeft, Math.round(point.x * scaleX) - scaledLeft)),
    y: Math.max(0, Math.min(scaledBottom - scaledTop, Math.round(point.y * scaleY) - scaledTop)),
  });

  return {
    left: scaledLeft,
    top: scaledTop,
    width: Math.max(1, scaledRight - scaledLeft),
    height: Math.max(1, scaledBottom - scaledTop),
    polygon: contour.map(toRelativePoint),
  };
};

const isPaperPixel = (
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number
): boolean => {
  const stats = getPixelStats(data, width, channels, x, y);
  // Lower threshold (115 instead of 140) to handle shadows in photos
  // Use stricter thresholds to avoid wood/skin tones (which have higher saturation)
  return stats.luma > 125 &&
    stats.saturation < 50 &&
    !stats.greenDominant &&
    !stats.blueDominant;
};

const average = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const percentile = (values: number[], ratio: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * ratio)));
  return sorted[index];
};

const createOutsidePolygonSvg = (width: number, height: number, polygon: Point[]): Buffer => {
  const points = polygon.map((point) => `${formatNumber(point.x)} ${formatNumber(point.y)}`);
  const pathData = [
    `M 0 0 H ${formatNumber(width)} V ${formatNumber(height)} H 0 Z`,
    `M ${points.join(' L ')} Z`,
  ].join(' ');

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<path d="${pathData}" fill="#fff" fill-rule="evenodd"/></svg>`
  );
};

const getRowStats = (
  data: Buffer,
  width: number,
  channels: number,
  y: number
): { bright: number; dark: number; green: number } => {
  let bright = 0;
  let dark = 0;
  let green = 0;

  for (let x = 0; x < width; x += 1) {
    const stats = getPixelStats(data, width, channels, x, y);
    if (stats.luma > 125) bright += 1;
    if (stats.luma < 100) dark += 1;
    if (stats.greenDominant) green += 1;
  }

  return {
    bright: bright / width,
    dark: dark / width,
    green: green / width,
  };
};

const getColumnStats = (
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  x: number,
  top: number,
  bottom: number
): { bright: number; dark: number; green: number } => {
  let bright = 0;
  let dark = 0;
  let green = 0;
  const start = Math.max(0, top);
  const end = Math.min(height, bottom);
  const count = Math.max(1, end - start);

  for (let y = start; y < end; y += 1) {
    const stats = getPixelStats(data, width, channels, x, y);
    if (stats.luma > 125) bright += 1;
    if (stats.luma < 100) dark += 1;
    if (stats.greenDominant) green += 1;
  }

  return {
    bright: bright / count,
    dark: dark / count,
    green: green / count,
  };
};

const getPixelStats = (
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y: number
): { luma: number; saturation: number; greenDominant: boolean; blueDominant: boolean } => {
  const index = (y * width + x) * channels;
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const luma = 0.299 * red + 0.587 * green + 0.114 * blue;
  const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);

  return {
    luma,
    saturation,
    greenDominant: green > red * 1.1 && green > blue * 1.1 && green > 80,
    blueDominant: blue > red * 1.08 && blue > green * 1.05 && blue > 75,
  };
};

const findTop = (
  rowStats: Array<{ bright: number; dark: number; green: number }>,
  height: number
): number => {
  const limit = Math.floor(height * 0.35);

  for (let y = 0; y < limit; y += 1) {
    const window = rowStats.slice(y, y + 8);
    if (window.length < 8) break;
    const match = window.every((row) => row.bright > 0.78 && row.dark < 0.08 && row.green < 0.12);
    const hasNoisyRowsBefore = rowStats.slice(Math.max(0, y - 45), y).some((row) => row.dark > 0.1 || row.green > 0.12);
    if (match && (hasNoisyRowsBefore || y < height * 0.08)) return y;
  }

  return 0;
};

const findBottom = (
  rowStats: Array<{ bright: number; dark: number; green: number }>,
  height: number,
  top: number
): number => {
  const start = Math.max(Math.floor(height * 0.5), top + 20);

  for (let y = start; y < height; y += 1) {
    const window = rowStats.slice(y, y + 10);
    if (window.length < 10) break;
    const background = window.every((row) => row.green > 0.2 || row.dark > 0.35 || row.bright < 0.35);
    if (background) return y;
  }

  return height;
};

const findLeft = (
  colStats: Array<{ bright: number; dark: number; green: number }>,
  width: number
): number => {
  for (let x = 0; x < Math.floor(width * 0.35); x += 1) {
    const window = colStats.slice(x, x + 8);
    if (window.length < 8) break;
    if (window.every((col) => col.bright > 0.75 && col.dark < 0.16 && col.green < 0.15)) return x;
  }

  return 0;
};

const findRight = (
  colStats: Array<{ bright: number; dark: number; green: number }>,
  width: number
): number => {
  for (let x = width - 1; x > Math.floor(width * 0.65); x -= 1) {
    const window = colStats.slice(Math.max(0, x - 7), x + 1);
    if (window.length < 8) break;
    if (window.every((col) => col.bright > 0.75 && col.dark < 0.16 && col.green < 0.15)) return x + 1;
  }

  return width;
};

const createSinglePageImagePdf = (
  jpegBuffer: Buffer,
  imageWidth: number,
  imageHeight: number
): Buffer => {
  const maxWidth = A4_WIDTH_PT - PAGE_MARGIN_PT * 2;
  const maxHeight = A4_HEIGHT_PT - PAGE_MARGIN_PT * 2;
  const scale = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const x = (A4_WIDTH_PT - drawWidth) / 2;
  const y = (A4_HEIGHT_PT - drawHeight) / 2;

  const content = [
    'q',
    `${formatNumber(drawWidth)} 0 0 ${formatNumber(drawHeight)} ${formatNumber(x)} ${formatNumber(y)} cm`,
    '/Im0 Do',
    'Q',
    '',
  ].join('\n');

  const chunks: Buffer[] = [];
  const offsets: number[] = [];
  let length = 0;

  const write = (chunk: string | Buffer) => {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk;
    chunks.push(buffer);
    length += buffer.length;
  };

  const writeObject = (objectNumber: number, parts: Array<string | Buffer>) => {
    offsets[objectNumber] = length;
    write(`${objectNumber} 0 obj\n`);
    parts.forEach(write);
    write('\nendobj\n');
  };

  write(Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]));
  write(Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  writeObject(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  writeObject(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
  writeObject(3, [
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${formatNumber(A4_WIDTH_PT)} ${formatNumber(A4_HEIGHT_PT)}] `,
    '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
  ]);
  writeObject(4, [
    `<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} `,
    `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuffer.length} >>\nstream\n`,
    jpegBuffer,
    '\nendstream',
  ]);
  writeObject(5, [`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}endstream`]);
  writeObject(6, ['<< /Producer (DocIntel) /Title (Image preview) >>']);

  const xrefOffset = length;
  write(`xref\n0 7\n0000000000 65535 f \n`);

  for (let i = 1; i <= 6; i += 1) {
    write(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  write(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.concat(chunks);
};

const formatNumber = (value: number): string => {
  return Number(value.toFixed(2)).toString();
};
