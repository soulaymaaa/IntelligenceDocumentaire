'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import {
  AlignLeft,
  Archive,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FileSearch,
  FileText,
  GitBranch,
  Highlighter,
  Languages,
  RefreshCw,
  Scan,
  Sparkles,
  Pencil,
  Check,
  X,
  Trash2,
  Undo2,
  Download,
  XCircle,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConversationPanel } from '@/components/ai/ConversationPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { documentsApi, aiApi, conversationsApi } from '@/lib/api';
import { formatBytes, formatDate, getDocumentPreviewUrl, getErrorMessage, highlightText } from '@/lib/utils';
import { useLanguage } from '@/providers/LanguageProvider';
import { QRTrigger } from '@/components/layout/QRTrigger';
import type { Conversation, Document, MindMapNode, MindMapPayload, SummaryPayload } from '@/types';

type DetailTab = 'overview' | 'highlights' | 'summary' | 'mind_map' | 'charts' | 'chat' | 'translation';
type SupportedLang = 'ar' | 'en' | 'fr';
type SourceLang = SupportedLang | 'auto';

const LANG_LABELS: Record<SupportedLang, { label: string; native: string; dir: 'ltr' | 'rtl' }> = {
  ar: { label: 'Arabic', native: 'العربية', dir: 'rtl' },
  en: { label: 'English', native: 'English', dir: 'ltr' },
  fr: { label: 'Français', native: 'Français', dir: 'ltr' },
};
type SummaryView = 'short' | 'detailed' | 'key_points';
// ── PDF Preview with error handling ──────────────────────────────────────────

const PdfPreview = ({ url, originalName }: { url: string; originalName: string }) => {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === 'loading') setStatus('error');
    }, 6000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className="relative h-[680px] w-full overflow-hidden rounded-2xl border border-surface-200 bg-slate-50">
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 z-10">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-slate-500">Chargement du document…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-50 z-10 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-500">
            <XCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">Aperçu non disponible</p>
            <p className="mt-1 text-sm text-slate-500">
              Le backend doit être démarré sur{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">localhost:3001</code>
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="w-4 h-4" />
            Ouvrir dans un nouvel onglet
          </Button>
        </div>
      )}

      <iframe
        ref={iframeRef}
        title={`Aperçu — ${originalName}`}
        src={url}
        className="h-full w-full bg-white"
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('error')}
        style={{ display: status === 'error' ? 'none' : 'block' }}
      />
    </div>
  );
};

type ScannedImagePreview = {
  src: string;
  width: number;
  height: number;
};

type ScanPoint = {
  x: number;
  y: number;
};

type PaperDetection = {
  x: number;
  y: number;
  width: number;
  height: number;
  corners: [ScanPoint, ScanPoint, ScanPoint, ScanPoint];
};

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const clampPoint = (point: ScanPoint, width: number, height: number): ScanPoint => ({
  x: Math.max(0, Math.min(width - 1, point.x)),
  y: Math.max(0, Math.min(height - 1, point.y)),
});

const distanceBetween = (a: ScanPoint, b: ScanPoint) => Math.hypot(a.x - b.x, a.y - b.y);

const quadArea = (points: [ScanPoint, ScanPoint, ScanPoint, ScanPoint]) => {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area) / 2;
};

const loadPreviewImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image preview failed to load'));
    image.src = url;
  });

const getPercentile = (values: number[], percentile: number) => {
  if (!values.length) return percentile > 0.5 ? 255 : 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * percentile)));
  return sorted[index];
};

const isPaperLikePixel = (data: Uint8ClampedArray, index: number) => {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return (luma > 142 && chroma < 78) || (luma > 184 && chroma < 118);
};

const detectPaperBounds = (data: Uint8ClampedArray, width: number, height: number): PaperDetection | null => {
  const totalPixels = width * height;
  const mask = new Uint8Array(totalPixels);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      mask[y * width + x] = isPaperLikePixel(data, index) ? 1 : 0;
    }
  }

  const visited = new Uint8Array(totalPixels);
  const stack = new Int32Array(totalPixels);
  const minComponentPixels = Math.max(120, Math.floor(totalPixels * 0.018));
  let bestDetection: PaperDetection | null = null;
  let bestScore = 0;

  for (let start = 0; start < totalPixels; start += 1) {
    if (!mask[start] || visited[start]) continue;

    let stackLength = 0;
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let minSum = Number.POSITIVE_INFINITY;
    let maxSum = Number.NEGATIVE_INFINITY;
    let minDiff = Number.POSITIVE_INFINITY;
    let maxDiff = Number.NEGATIVE_INFINITY;
    let topLeft: ScanPoint = { x: 0, y: 0 };
    let topRight: ScanPoint = { x: 0, y: 0 };
    let bottomRight: ScanPoint = { x: 0, y: 0 };
    let bottomLeft: ScanPoint = { x: 0, y: 0 };

    visited[start] = 1;
    stack[stackLength] = start;
    stackLength += 1;

    while (stackLength > 0) {
      stackLength -= 1;
      const position = stack[stackLength];
      const x = position % width;
      const y = Math.floor(position / width);
      count += 1;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const sum = x + y;
      const diff = x - y;
      if (sum < minSum) {
        minSum = sum;
        topLeft = { x, y };
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        topRight = { x, y };
      }
      if (sum > maxSum) {
        maxSum = sum;
        bottomRight = { x, y };
      }
      if (diff < minDiff) {
        minDiff = diff;
        bottomLeft = { x, y };
      }

      const left = position - 1;
      const right = position + 1;
      const up = position - width;
      const down = position + width;

      if (x > 0 && mask[left] && !visited[left]) {
        visited[left] = 1;
        stack[stackLength] = left;
        stackLength += 1;
      }
      if (x < width - 1 && mask[right] && !visited[right]) {
        visited[right] = 1;
        stack[stackLength] = right;
        stackLength += 1;
      }
      if (y > 0 && mask[up] && !visited[up]) {
        visited[up] = 1;
        stack[stackLength] = up;
        stackLength += 1;
      }
      if (y < height - 1 && mask[down] && !visited[down]) {
        visited[down] = 1;
        stack[stackLength] = down;
        stackLength += 1;
      }
    }

    if (count < minComponentPixels) continue;

    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    if (boxWidth < width * 0.22 || boxHeight < height * 0.22) continue;

    const fallbackCorners: [ScanPoint, ScanPoint, ScanPoint, ScanPoint] = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
    const detectedCorners: [ScanPoint, ScanPoint, ScanPoint, ScanPoint] = [
      topLeft,
      topRight,
      bottomRight,
      bottomLeft,
    ];
    const detectedArea = quadArea(detectedCorners);
    const boxArea = boxWidth * boxHeight;
    const corners = detectedArea > boxArea * 0.34 ? detectedCorners : fallbackCorners;
    const aspect = boxHeight / Math.max(1, boxWidth);
    const aspectScore = aspect > 0.72 && aspect < 2.4 ? 1 : 0.48;
    const edgeTouches =
      (minX <= 1 ? 1 : 0) + (minY <= 1 ? 1 : 0) + (maxX >= width - 2 ? 1 : 0) + (maxY >= height - 2 ? 1 : 0);
    const edgeScore = edgeTouches >= 3 ? 0.35 : 1;
    const fillRatio = count / boxArea;
    const score = count * Math.min(1, fillRatio * 2.5) * aspectScore * edgeScore;

    if (score > bestScore) {
      bestScore = score;
      bestDetection = {
        x: minX,
        y: minY,
        width: boxWidth,
        height: boxHeight,
        corners,
      };
    }
  }

  if (!bestDetection) return null;

  const padX = Math.round(bestDetection.width * 0.018);
  const padY = Math.round(bestDetection.height * 0.018);
  const x = Math.max(0, bestDetection.x - padX);
  const y = Math.max(0, bestDetection.y - padY);
  const paddedRight = Math.min(width - 1, bestDetection.x + bestDetection.width + padX);
  const paddedBottom = Math.min(height - 1, bestDetection.y + bestDetection.height + padY);

  return {
    x,
    y,
    width: Math.max(1, paddedRight - x),
    height: Math.max(1, paddedBottom - y),
    corners: bestDetection.corners,
  };
};

const expandScanQuad = (
  points: [ScanPoint, ScanPoint, ScanPoint, ScanPoint],
  width: number,
  height: number,
  amount = 0.02
): [ScanPoint, ScanPoint, ScanPoint, ScanPoint] => {
  const center = points.reduce(
    (acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }),
    { x: 0, y: 0 }
  );

  return points.map((point) =>
    clampPoint(
      {
        x: center.x + (point.x - center.x) * (1 + amount),
        y: center.y + (point.y - center.y) * (1 + amount),
      },
      width,
      height
    )
  ) as [ScanPoint, ScanPoint, ScanPoint, ScanPoint];
};

const drawPerspectiveScan = (
  image: HTMLImageElement,
  sourceWidth: number,
  sourceHeight: number,
  corners: [ScanPoint, ScanPoint, ScanPoint, ScanPoint]
) => {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const rawWidth = Math.max(distanceBetween(topLeft, topRight), distanceBetween(bottomLeft, bottomRight));
  const rawHeight = Math.max(distanceBetween(topLeft, bottomLeft), distanceBetween(topRight, bottomRight));
  const outputScale = Math.min(1, 1900 / Math.max(rawWidth, rawHeight));
  const outputWidth = Math.max(1, Math.round(rawWidth * outputScale));
  const outputHeight = Math.max(1, Math.round(rawHeight * outputScale));

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) throw new Error('Canvas is not available');
  sourceContext.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  const sourcePixels = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight).data;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputContext = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!outputContext) throw new Error('Canvas is not available');
  const outputData = outputContext.createImageData(outputWidth, outputHeight);
  const outputPixels = outputData.data;

  for (let y = 0; y < outputHeight; y += 1) {
    const v = outputHeight <= 1 ? 0 : y / (outputHeight - 1);
    const invV = 1 - v;

    for (let x = 0; x < outputWidth; x += 1) {
      const u = outputWidth <= 1 ? 0 : x / (outputWidth - 1);
      const invU = 1 - u;
      const sourceX =
        topLeft.x * invU * invV + topRight.x * u * invV + bottomRight.x * u * v + bottomLeft.x * invU * v;
      const sourceY =
        topLeft.y * invU * invV + topRight.y * u * invV + bottomRight.y * u * v + bottomLeft.y * invU * v;
      const x0 = Math.max(0, Math.min(sourceWidth - 1, Math.floor(sourceX)));
      const y0 = Math.max(0, Math.min(sourceHeight - 1, Math.floor(sourceY)));
      const x1 = Math.min(sourceWidth - 1, x0 + 1);
      const y1 = Math.min(sourceHeight - 1, y0 + 1);
      const wx = sourceX - x0;
      const wy = sourceY - y0;
      const sourceIndex00 = (y0 * sourceWidth + x0) * 4;
      const sourceIndex10 = (y0 * sourceWidth + x1) * 4;
      const sourceIndex01 = (y1 * sourceWidth + x0) * 4;
      const sourceIndex11 = (y1 * sourceWidth + x1) * 4;
      const targetIndex = (y * outputWidth + x) * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        const top = sourcePixels[sourceIndex00 + channel] * (1 - wx) + sourcePixels[sourceIndex10 + channel] * wx;
        const bottom = sourcePixels[sourceIndex01 + channel] * (1 - wx) + sourcePixels[sourceIndex11 + channel] * wx;
        outputPixels[targetIndex + channel] = top * (1 - wy) + bottom * wy;
      }
      outputPixels[targetIndex + 3] = 255;
    }
  }

  outputContext.putImageData(outputData, 0, 0);
  return { canvas: outputCanvas, width: outputWidth, height: outputHeight };
};

const createScannedImagePreview = async (url: string): Promise<ScannedImagePreview> => {
  const image = await loadPreviewImage(url);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  const detectionScale = Math.min(1, 950 / Math.max(sourceWidth, sourceHeight));
  const detectionWidth = Math.max(1, Math.round(sourceWidth * detectionScale));
  const detectionHeight = Math.max(1, Math.round(sourceHeight * detectionScale));
  const detectionCanvas = document.createElement('canvas');
  detectionCanvas.width = detectionWidth;
  detectionCanvas.height = detectionHeight;
  const detectionContext = detectionCanvas.getContext('2d', { willReadFrequently: true });
  if (!detectionContext) throw new Error('Canvas is not available');

  detectionContext.drawImage(image, 0, 0, detectionWidth, detectionHeight);
  const detectionData = detectionContext.getImageData(0, 0, detectionWidth, detectionHeight);
  const detectedBounds = detectPaperBounds(detectionData.data, detectionWidth, detectionHeight);
  const detectedCorners = detectedBounds
    ? expandScanQuad(
        detectedBounds.corners.map((point) => ({
          x: point.x / detectionScale,
          y: point.y / detectionScale,
        })) as [ScanPoint, ScanPoint, ScanPoint, ScanPoint],
        sourceWidth,
        sourceHeight
      )
    : null;
  const sourceBounds = detectedBounds
    ? {
        x: Math.round(detectedBounds.x / detectionScale),
        y: Math.round(detectedBounds.y / detectionScale),
        width: Math.round(detectedBounds.width / detectionScale),
        height: Math.round(detectedBounds.height / detectionScale),
      }
    : { x: 0, y: 0, width: sourceWidth, height: sourceHeight };

  const outputScale = Math.min(1, 1800 / Math.max(sourceBounds.width, sourceBounds.height));
  const outputWidth = Math.max(1, Math.round(sourceBounds.width * outputScale));
  const outputHeight = Math.max(1, Math.round(sourceBounds.height * outputScale));
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outputWidth;
  outputCanvas.height = outputHeight;
  const outputContext = outputCanvas.getContext('2d', { willReadFrequently: true });
  if (!outputContext) throw new Error('Canvas is not available');

  if (detectedCorners) {
    const perspectiveScan = drawPerspectiveScan(image, sourceWidth, sourceHeight, detectedCorners);
    outputCanvas.width = perspectiveScan.width;
    outputCanvas.height = perspectiveScan.height;
    outputContext.drawImage(perspectiveScan.canvas, 0, 0);
  } else {
    outputContext.fillStyle = '#ffffff';
    outputContext.fillRect(0, 0, outputWidth, outputHeight);
    outputContext.drawImage(
      image,
      sourceBounds.x,
      sourceBounds.y,
      sourceBounds.width,
      sourceBounds.height,
      0,
      0,
      outputWidth,
      outputHeight
    );
  }

  const finalWidth = outputCanvas.width;
  const finalHeight = outputCanvas.height;
  const imageData = outputContext.getImageData(0, 0, finalWidth, finalHeight);
  const pixels = imageData.data;
  const lumaSamples: number[] = [];
  const sampleStep = Math.max(4, Math.floor(Math.max(finalWidth, finalHeight) / 520));

  for (let y = 0; y < finalHeight; y += sampleStep) {
    for (let x = 0; x < finalWidth; x += sampleStep) {
      const index = (y * finalWidth + x) * 4;
      lumaSamples.push(0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
    }
  }

  const blackPoint = getPercentile(lumaSamples, 0.04);
  const whitePoint = getPercentile(lumaSamples, 0.94);
  const span = Math.max(48, whitePoint - blackPoint);

  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const normalized = Math.max(0, Math.min(1, (luma - blackPoint) / span));
    const contrasted = clampChannel((normalized * 255 - 128) * 1.18 + 128);
    const paperLift = contrasted > 202 ? 24 : contrasted > 168 ? 10 : 0;
    const textDrop = contrasted < 88 ? -18 : 0;
    const scanTone = clampChannel(contrasted + paperLift + textDrop);

    pixels[index] = clampChannel(r * 0.34 + scanTone * 0.66);
    pixels[index + 1] = clampChannel(g * 0.34 + scanTone * 0.66);
    pixels[index + 2] = clampChannel(b * 0.34 + scanTone * 0.66);
  }

  outputContext.putImageData(imageData, 0, 0);

  return {
    src: outputCanvas.toDataURL('image/jpeg', 0.92),
    width: finalWidth,
    height: finalHeight,
  };
};

const ImagePreview = ({ url, originalName }: { url: string; originalName: string }) => {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [scanPreview, setScanPreview] = useState<ScannedImagePreview | null>(null);
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setDisplaySrc(null);
    setScanPreview(null);

    createScannedImagePreview(url)
      .then((preview) => {
        if (cancelled) return;
        setScanPreview(preview);
        setDisplaySrc(preview.src);
      })
      .catch(() => {
        if (cancelled) return;
        setDisplaySrc(url);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="relative h-[680px] w-full overflow-hidden rounded-2xl border border-surface-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-950">
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-100/95 dark:bg-slate-950/95">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-slate-500">Preparation du scan...</p>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-slate-50 px-8 text-center dark:bg-slate-950">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-500">
            <XCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">Aperçu non disponible</p>
            <p className="mt-1 text-sm text-slate-500">Cliquez sur “Ouvrir l’original”.</p>
          </div>
        </div>
      )}

      <div className="h-full overflow-auto px-3 py-5 sm:px-5">
        <div className="flex min-h-full items-start justify-center">
          {displaySrc && status !== 'error' && (
            <div
              className="w-full max-w-[560px] rounded-[4px] bg-white p-1 shadow-[0_26px_70px_rgba(15,23,42,0.28)] ring-1 ring-slate-300/80 dark:ring-slate-700"
              style={scanPreview ? { aspectRatio: `${scanPreview.width} / ${scanPreview.height}` } : undefined}
            >
              <img
                src={displaySrc}
                alt={originalName}
                className="block h-auto w-full rounded-[2px] bg-white object-contain"
                onLoad={() => setStatus('ok')}
                onError={() => setStatus('error')}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DocxPreview = ({ url }: { url: string }) => {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setStatus('loading');
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
        const buf = await res.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        if (cancelled) return;
        setHtml(result.value || '');
        setStatus('ok');
      } catch {
        if (cancelled) return;
        setStatus('error');
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="relative h-[680px] w-full overflow-hidden rounded-2xl border border-surface-200 bg-white dark:bg-slate-950 dark:border-slate-700">
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white z-10">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-slate-500">Chargement du document…</p>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white z-10 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-500">
            <XCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">Aperçu Word non disponible</p>
            <p className="mt-1 text-sm text-slate-500">Cliquez sur “Ouvrir l’original”.</p>
          </div>
        </div>
      )}

      {status === 'ok' && (
        <div className="h-full overflow-auto bg-white p-6 dark:bg-slate-950">
          {/* Mammoth reprend les couleurs Word (souvent très claires) : on impose un texte lisible */}
          <style>{`
            .docx-preview-content,
            .docx-preview-content p,
            .docx-preview-content li,
            .docx-preview-content td,
            .docx-preview-content th,
            .docx-preview-content span,
            .docx-preview-content div {
              color: rgb(15 23 42) !important;
            }
            .docx-preview-content h1,
            .docx-preview-content h2,
            .docx-preview-content h3,
            .docx-preview-content h4,
            .docx-preview-content h5,
            .docx-preview-content h6 {
              color: rgb(15 23 42) !important;
              font-weight: 800;
            }
            .docx-preview-content a {
              color: rgb(37 99 235) !important;
              text-decoration: underline;
            }
            .dark .docx-preview-content,
            .dark .docx-preview-content p,
            .dark .docx-preview-content li,
            .dark .docx-preview-content td,
            .dark .docx-preview-content th,
            .dark .docx-preview-content span,
            .dark .docx-preview-content div,
            .dark .docx-preview-content h1,
            .dark .docx-preview-content h2,
            .dark .docx-preview-content h3,
            .dark .docx-preview-content h4,
            .dark .docx-preview-content h5,
            .dark .docx-preview-content h6 {
              color: rgb(241 245 249) !important;
            }
            .dark .docx-preview-content a {
              color: rgb(96 165 250) !important;
            }
          `}</style>
          <div
            className="docx-preview-content prose prose-slate max-w-none text-base leading-relaxed text-slate-900 prose-headings:font-extrabold prose-p:text-slate-900 prose-li:text-slate-900 dark:prose-invert dark:prose-headings:text-slate-100 dark:prose-p:text-slate-100"
            dangerouslySetInnerHTML={{ __html: html || '<p>(Document vide)</p>' }}
          />
        </div>
      )}
    </div>
  );
};

const translationLanguages = [
  { value: 'French', label: 'Français' },
  { value: 'English', label: 'Anglais' },
  { value: 'Spanish', label: 'Espagnol' },
  { value: 'German', label: 'Allemand' },
  { value: 'Italian', label: 'Italien' },
  { value: 'Portuguese', label: 'Portugais' },
  { value: 'Arabic', label: 'Arabe' },
];

type ChartType = 'line' | 'bar' | 'pie';

const isSpreadsheetDocument = (doc?: Document | null) => {
  const mime = (doc?.mimeType || '').toLowerCase();
  const name = (doc?.originalName || '').toLowerCase();
  return (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv')
  );
};

const PIES = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

const SpreadsheetPreview = ({ doc }: { doc: Document }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAutoLoadedRef = useRef(false);

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);

  const fileUrl = useMemo(() => getDocumentPreviewUrl(doc.filename), [doc.filename]);

  const loadWorkbook = async () => {
    if (!fileUrl) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);

      const name = doc.originalName?.toLowerCase() || '';
      const isCsv = name.endsWith('.csv') || (doc.mimeType || '').toLowerCase().includes('csv');

      const wb = isCsv
        ? XLSX.read(await res.text(), { type: 'string' })
        : XLSX.read(await res.arrayBuffer(), { type: 'array' });

      setWorkbook(wb);
      const first = wb.SheetNames[0] || '';
      setSheetName(first);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    hasAutoLoadedRef.current = false;
    setWorkbook(null);
    setSheetName('');
    setHeaders([]);
    setRows([]);
  }, [doc._id]);

  useEffect(() => {
    if (!fileUrl) return;
    if (hasAutoLoadedRef.current) return;
    hasAutoLoadedRef.current = true;
    loadWorkbook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  useEffect(() => {
    if (!workbook || !sheetName) return;
    const ws = workbook.Sheets[sheetName];
    if (!ws) return;

    const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false }) as any[][];
    const hdr = (matrix[0] || []).map((h: any, i: number) => String(h ?? `Col ${i + 1}`).trim() || `Col ${i + 1}`);
    const dataRows = matrix
      .slice(1)
      .filter((r) => Array.isArray(r) && r.some((v) => v !== null && v !== undefined && String(v).trim() !== ''));

    const objects = dataRows.map((r) => {
      const obj: Record<string, any> = {};
      hdr.forEach((key, idx) => {
        obj[key] = r?.[idx];
      });
      return obj;
    });

    setHeaders(hdr);
    setRows(objects);
  }, [workbook, sheetName]);

  return (
    <div className="rounded-2xl border border-surface-200 bg-slate-950 text-white overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">Aperçu du tableur</p>
          <p className="mt-1 text-sm font-bold text-white/80 truncate">{doc.originalName}</p>
        </div>

        <div className="flex items-center gap-2">
          {workbook?.SheetNames?.length ? (
            <select
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              className="h-10 max-w-[220px] appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wider text-white/80 outline-none"
            >
              {workbook.SheetNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : null}

          <Button
            variant="secondary"
            size="sm"
            className="border-white/10 bg-white/10 text-white hover:bg-white/20"
            onClick={loadWorkbook}
            isLoading={isLoading}
            disabled={!fileUrl || isLoading}
          >
            Recharger
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        </div>
      )}

      {isLoading && !rows.length && (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-6 py-10">
          <Spinner size="lg" />
          <p className="text-sm font-bold text-white/70">Chargement du tableur…</p>
        </div>
      )}

      {!isLoading && !error && !rows.length && (
        <div className="flex min-h-[420px] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <p className="text-sm font-bold text-white/80">Aucune donnée trouvée</p>
          <p className="text-sm font-medium text-white/50">
            Vérifie la feuille sélectionnée ou le format du fichier.
          </p>
        </div>
      )}

      {!!rows.length && (
        <div className="max-h-[680px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-white/10">
              <tr>
                {headers.map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white/60 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                  {headers.map((h) => (
                    <td key={h} className="px-5 py-3 text-white/85 whitespace-nowrap">
                      {r[h] === null || r[h] === undefined || r[h] === '' ? (
                        <span className="text-white/30">—</span>
                      ) : (
                        String(r[h])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-5 py-3 border-t border-white/10 text-[11px] font-black uppercase tracking-widest text-white/40">
        Lignes: {rows.length.toLocaleString()}
      </div>
    </div>
  );
};

const parsePipeTable = (text: string) => {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Expect first meaningful header line like: "N° | Product Name | Link | ..."
  const headerLine = rawLines.find((l) => l.includes('|'));
  if (!headerLine) return null;

  const headers = headerLine
    .split('|')
    .map((h) => h.trim())
    .filter(Boolean);

  if (headers.length < 2) return null;

  const normalizedHeaders = headers.map((h) =>
    h
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  );
  const findHeaderIndex = (pred: (h: string) => boolean) => normalizedHeaders.findIndex(pred);
  const descIdx =
    findHeaderIndex((h) => h.includes('description') || h.includes('desc')) >= 0
      ? findHeaderIndex((h) => h.includes('description') || h.includes('desc'))
      : headers.length - 1;
  const priceIdx = findHeaderIndex((h) => h.includes('price') || h.includes('prix') || h.includes('cost') || h.includes('coût'));

  const startIdx = rawLines.indexOf(headerLine) + 1;
  const rows: string[][] = [];

  const isRowStart = (line: string) => {
    if (!line.includes('|')) return false;
    const first = line.split('|')[0]?.trim() || '';
    return /^\d+/.test(first) || /^n[°º]?\s*\d+/i.test(first);
  };

  const isPriceLine = (line: string) => {
    const s = line.trim();
    if (!s) return false;
    if (/^[-—–]+$/.test(s)) return false;
    // Examples: "185.000 TND", "185,000", "185000", "185.00 €"
    return /(^\d[\d\s.,]*\s*(tnd|dt|dinar|€|\$|usd|eur)\b)|(^\d[\d\s.,]*$)/i.test(s);
  };

  const appendToCell = (row: string[], idx: number, line: string) => {
    const safeIdx = Math.max(0, Math.min(idx, headers.length - 1));
    row[safeIdx] = row[safeIdx] ? `${row[safeIdx]}\n${line}` : line;
  };

  const pushOrContinue = (line: string) => {
    // If it's a new row (has pipes and starts with number), parse as row
    if (isRowStart(line)) {
      const parts = line.split('|').map((p) => p.trim());
      const cleaned = parts.filter((p) => p !== '');
      if (cleaned.length < 2) return;
      rows.push(cleaned);
      return;
    }

    // Otherwise treat as a continuation of the last row:
    // - price-like lines go to Price column (if present)
    // - otherwise go to Description column
    if (!rows.length) return;
    const lastRow = rows[rows.length - 1];
    // If continuation contains pipes, it might be "Dimension ... | 185.000 TND".
    // In that case, map left part to Description and right part (if price-like) to Price.
    if (line.includes('|')) {
      const parts = line
        .split('|')
        .map((p) => p.trim())
        .filter(Boolean);

      if (parts.length >= 2) {
        const last = parts[parts.length - 1] || '';
        const rest = parts.slice(0, -1).join(' | ');

        if (priceIdx >= 0 && isPriceLine(last)) {
          if (rest) appendToCell(lastRow, descIdx, rest);
          appendToCell(lastRow, priceIdx, last);
          return;
        }

        // Not a price continuation: keep everything in Description
        appendToCell(lastRow, descIdx, parts.join(' | '));
        return;
      }
    }

    if (priceIdx >= 0 && isPriceLine(line)) {
      appendToCell(lastRow, priceIdx, line);
      return;
    }
    appendToCell(lastRow, descIdx, line);
  };

  for (const l of rawLines.slice(startIdx)) {
    pushOrContinue(l);
  }

  if (!rows.length) return null;
  return { headers, rows };
};

const TranslationSpreadsheetTable = ({
  parsed,
}: {
  parsed: { headers: string[]; rows: string[][] };
}) => {
  const { headers, rows } = parsed;
  const maxCols = headers.length;
  const normalizedHeaders = useMemo(
    () =>
      headers.map((h) =>
        h
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim()
      ),
    [headers]
  );

  const colRole = (idx: number) => {
    const h = normalizedHeaders[idx] || '';
    if (h === 'n°' || h === 'no' || h === 'n' || h.startsWith('n°')) return 'index';
    if (h.includes('product') || h.includes('produit') || h.includes('name') || h.includes('nom')) return 'name';
    if (h.includes('link') || h.includes('lien') || h.includes('url')) return 'link';
    if (h.includes('description') || h.includes('desc')) return 'desc';
    if (h.includes('image') || h.includes('img') || h.includes('photo')) return 'image';
    if (h.includes('price') || h.includes('prix') || h.includes('cost') || h.includes('coût')) return 'price';
    return 'default';
  };

  const roleWidths: Record<string, string> = {
    index: '70px',
    price: '120px',
    image: '120px',
    link: '260px',
    name: '280px',
    desc: '520px',
    default: '220px',
  };

  const renderCell = (value: string) => {
    const v = (value || '').trim();
    if (!v) return <span className="text-white/30">—</span>;

    const isLink = /^https?:\/\//i.test(v);
    if (isLink) {
      return (
        <a
          href={v}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2 break-all"
        >
          {v}
        </a>
      );
    }

    return <span className="whitespace-pre-wrap break-words">{v}</span>;
  };

  return (
    <div className="max-h-[600px] overflow-auto rounded-2xl border border-surface-200 bg-slate-950 text-white">
      <table className="min-w-full text-sm table-fixed">
        <colgroup>
          {Array.from({ length: maxCols }).map((_, i) => {
            const role = colRole(i);
            return <col key={i} style={{ width: roleWidths[role] || roleWidths.default }} />;
          })}
        </colgroup>
        <thead className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-white/10">
          <tr>
            {headers.map((h, i) => (
              <th
                key={`${h}-${i}`}
                className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white/60 whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr
              key={idx}
              className={`border-b border-white/5 hover:bg-white/5 ${
                idx % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'
              }`}
            >
              {Array.from({ length: maxCols }).map((_, c) => {
                const v = r[c] ?? '';
                const role = colRole(c);
                const cell = String(v ?? '');
                return (
                  <td
                    key={c}
                    className={[
                      'px-5 py-3 text-white/85 align-top',
                      role === 'index' ? 'text-white/60 font-black' : '',
                      role === 'price' ? 'text-right font-black whitespace-nowrap' : '',
                      role === 'name' ? 'font-bold' : '',
                    ].join(' ')}
                  >
                    {role === 'image' ? (
                      (() => {
                        const url = cell.trim();
                        const isUrl = /^https?:\/\//i.test(url);
                        if (!isUrl) return <span className="text-white/30">—</span>;
                        return (
                          <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                              src={url}
                              alt=""
                              className="h-10 w-10 rounded-lg object-cover border border-white/10 bg-white/5"
                              loading="lazy"
                            />
                          </a>
                        );
                      })()
                    ) : (
                      renderCell(cell)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const SpreadsheetCharts = ({ doc }: { doc: Document }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAutoLoadedRef = useRef(false);

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);

  const [chartType, setChartType] = useState<ChartType>('line');
  const [xKey, setXKey] = useState<string>('');
  const [yKey, setYKey] = useState<string>('');

  const fileUrl = useMemo(() => getDocumentPreviewUrl(doc.filename), [doc.filename]);

  const loadWorkbook = async () => {
    if (!fileUrl) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);

      const name = doc.originalName?.toLowerCase() || '';
      const isCsv = name.endsWith('.csv') || (doc.mimeType || '').toLowerCase().includes('csv');

      if (isCsv) {
        const text = await res.text();
        const wb = XLSX.read(text, { type: 'string' });
        setWorkbook(wb);
        const first = wb.SheetNames[0] || '';
        setSheetName(first);
      } else {
        const buf = await res.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        setWorkbook(wb);
        const first = wb.SheetNames[0] || '';
        setSheetName(first);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auto-load once per document when tab is opened
    hasAutoLoadedRef.current = false;
    setWorkbook(null);
    setSheetName('');
    setHeaders([]);
    setRows([]);
    setXKey('');
    setYKey('');
  }, [doc._id]);

  useEffect(() => {
    if (!fileUrl) return;
    if (hasAutoLoadedRef.current) return;
    hasAutoLoadedRef.current = true;
    loadWorkbook();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  useEffect(() => {
    if (!workbook || !sheetName) return;

    const ws = workbook.Sheets[sheetName];
    if (!ws) return;

    const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false }) as any[][];
    const hdr = (matrix[0] || []).map((h: any, i: number) => String(h ?? `Col ${i + 1}`).trim() || `Col ${i + 1}`);
    const dataRows = matrix.slice(1).filter((r) => Array.isArray(r) && r.some((v) => v !== null && v !== undefined && String(v).trim() !== ''));

    const objects = dataRows.map((r) => {
      const obj: Record<string, any> = {};
      hdr.forEach((key, idx) => {
        obj[key] = r?.[idx];
      });
      return obj;
    });

    setHeaders(hdr);
    setRows(objects);

    const isNumericValue = (v: any) => {
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v === 'string') {
        const s = v.trim().replace(/\s/g, '').replace(',', '.');
        if (!s) return false;
        return /^-?\d+(\.\d+)?$/.test(s);
      }
      return false;
    };

    const numericHeaders = hdr.filter((h) => objects.some((o) => isNumericValue(o[h])));
    const nonNumericHeaders = hdr.filter((h) => !numericHeaders.includes(h));

    // Defaults:
    // - Y = first numeric column (e.g. Prix)
    // - X = first non-numeric column (e.g. Nom du produit) else first header
    const yDefault = numericHeaders[0] || hdr[0] || '';
    const xDefault = nonNumericHeaders[0] || hdr[0] || '';

    setYKey((prev) => (prev && hdr.includes(prev) ? prev : yDefault));
    setXKey((prev) => (prev && hdr.includes(prev) ? prev : xDefault));
  }, [workbook, sheetName]);

  const numericHeaders = useMemo(() => {
    const isNumericValue = (v: any) => {
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v === 'string') {
        const s = v.trim().replace(/\s/g, '').replace(',', '.');
        if (!s) return false;
        return /^-?\d+(\.\d+)?$/.test(s);
      }
      return false;
    };
    return headers.filter((h) => rows.some((r) => isNumericValue(r[h])));
  }, [headers, rows]);

  const chartData = useMemo(() => {
    if (!xKey || !yKey) return [];
    return rows
      .map((r) => {
        const rawY = r[yKey];
        const y =
          typeof rawY === 'number'
            ? rawY
            : typeof rawY === 'string'
              ? Number(rawY.trim().replace(/\s/g, '').replace(',', '.'))
              : Number(rawY);
        return {
          ...r,
          __x: r[xKey],
          __y: Number.isFinite(y) ? y : null,
        };
      })
      .filter((r) => r.__x !== undefined && r.__x !== null && r.__x !== '' && r.__y !== null);
  }, [rows, xKey, yKey]);

  const formatXAxisTick = (value: any) => {
    const s = String(value ?? '');
    const max = 18;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  };

  const pieData = useMemo(() => {
    if (!chartData.length) return [];
    const byX = new Map<string, number>();
    for (const r of chartData) {
      const k = String(r.__x);
      byX.set(k, (byX.get(k) || 0) + (r.__y as number));
    }
    return Array.from(byX.entries()).slice(0, 20).map(([name, value]) => ({ name, value }));
  }, [chartData]);

  const previewRows = useMemo(() => rows.slice(0, 6), [rows]);
  const hasSheetData = headers.length > 0 && rows.length > 0;
  const yIsNumeric = !!yKey && numericHeaders.includes(yKey);
  const autoFixKeys = () => {
    const bestY = numericHeaders[0] || '';
    const bestX = headers.find((h) => h !== bestY) || headers[0] || '';
    if (bestY) setYKey(bestY);
    if (bestX) setXKey(bestX);
  };

  return (
    <Card className="border-surface-200">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Graphiques</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Génération automatique à l'ouverture. Ajustez ensuite les colonnes si besoin.
          </p>
        </div>
        <Button onClick={loadWorkbook} isLoading={isLoading} disabled={!fileUrl || isLoading} size="sm" variant="secondary">
          Recharger
        </Button>
      </div>

      {!fileUrl && (
        <div className="mt-6 rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-5 py-6 text-sm font-medium text-slate-500">
          Fichier indisponible.
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {isLoading && !workbook && (
        <div className="mt-6 flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-3xl border border-surface-200 bg-surface-50">
          <Spinner size="lg" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Chargement du tableur…</p>
        </div>
      )}

      {workbook && (
        <div className="mt-6 grid gap-4">
          {!yIsNumeric && numericHeaders.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-5 py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                    La colonne Y doit être numérique
                  </p>
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-0.5">
                    Colonnes numériques détectées : {numericHeaders.join(', ')}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={autoFixKeys}>
                Corriger automatiquement
              </Button>
            </div>
          )}

          {!hasSheetData && (
            <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-10 text-center">
              <AlertTriangle className="mx-auto w-10 h-10 text-amber-500" />
              <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">Aucune donnée exploitable</p>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                Le fichier est chargé, mais je ne trouve pas de lignes/colonnes à convertir en tableau.
              </p>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2 block">
                Feuille
              </label>
              <select
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                className="h-11 w-full appearance-none rounded-2xl border border-surface-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-none"
              >
                {workbook.SheetNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2 block">
                Axe X
              </label>
              <select
                value={xKey}
                onChange={(e) => setXKey(e.target.value)}
                className="h-11 w-full appearance-none rounded-2xl border border-surface-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-none"
              >
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2 block">
                Valeur (Y)
              </label>
              <select
                value={yKey}
                onChange={(e) => setYKey(e.target.value)}
                className="h-11 w-full appearance-none rounded-2xl border border-surface-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-none"
              >
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2 block">
                Type
              </label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                className="h-11 w-full appearance-none rounded-2xl border border-surface-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-none"
              >
                <option value="line">Courbe</option>
                <option value="bar">Barres</option>
                <option value="pie">Camembert</option>
              </select>
            </div>
          </div>

          <div className="rounded-3xl border border-surface-200 bg-white dark:bg-slate-950/50 p-4">
            {!xKey || !yKey ? (
              <div className="h-[360px] flex items-center justify-center text-sm font-medium text-slate-500">
                Choisissez les colonnes X et Y.
              </div>
            ) : !chartData.length ? (
              <div className="h-[360px] flex flex-col items-center justify-center gap-2 text-center px-6">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Graphique vide</p>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Je n’ai trouvé aucune valeur numérique dans <strong>{yKey}</strong> (ou aucune valeur X associée).
                  Essaie de changer la colonne Y ou la feuille.
                </p>
                {!yIsNumeric && numericHeaders.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={autoFixKeys} className="mt-2">
                    Utiliser {numericHeaders[0]} comme valeur (Y)
                  </Button>
                )}
              </div>
            ) : chartType === 'pie' ? (
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip />
                    <Legend />
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={130}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIES[i % PIES.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : chartType === 'bar' ? (
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="__x"
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      minTickGap={12}
                      height={70}
                      angle={-25}
                      textAnchor="end"
                      tickFormatter={formatXAxisTick}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={(label) => String(label ?? '')} />
                    <Legend />
                    <Bar dataKey="__y" name={yKey} fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="__x"
                      tick={{ fontSize: 12 }}
                      interval="preserveStartEnd"
                      minTickGap={12}
                      height={70}
                      angle={-25}
                      textAnchor="end"
                      tickFormatter={formatXAxisTick}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={(label) => String(label ?? '')} />
                    <Legend />
                    <Line type="monotone" dataKey="__y" name={yKey} stroke="#2563eb" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {!!workbook && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Lignes: {rows.length.toLocaleString()}
            </p>
          )}
        </div>
      )}
    </Card>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DocumentDetailPage() {
  const { copy } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = useState<DetailTab>('overview');
  const [summaryView, setSummaryView] = useState<SummaryView>('short');
  const [question, setQuestion] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [showMoveFolder, setShowMoveFolder] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const translationRef = useRef<HTMLDivElement>(null);

  // Translation state
  const [sourceLang, setSourceLang] = useState<SourceLang>('auto');
  const [targetLang, setTargetLang] = useState('English');
  const [translationResult, setTranslationResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: doc, isLoading, error } = useQuery<Document>({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id),
    refetchInterval: (query: any) => {
      const current = query.state.data as Document | undefined;
      return current?.status === 'pending' || current?.status === 'processing_ocr' ? 3000 : false;
    },
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => documentsApi.listFolders(),
  });

  useEffect(() => {
    if (doc) setEditedName(doc.originalName);
  }, [doc]);

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', 'document', id],
    queryFn: () => conversationsApi.list({ scope: 'document', documentId: id }),
    enabled: !!id,
  });

  const { data: activeConversation } = useQuery({
    queryKey: ['conversation', selectedConversationId],
    queryFn: () => conversationsApi.get(selectedConversationId!),
    enabled: !!selectedConversationId,
  });

  useEffect(() => {
    if (!selectedConversationId && conversations[0]?._id) {
      setSelectedConversationId(conversations[0]._id);
    }
  }, [conversations, selectedConversationId]);

  const deleteMutation = useMutation({
    mutationFn: () => documentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.push('/documents');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => documentsApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', id] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => documentsApi.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', id] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const ocrMutation = useMutation({
    mutationFn: () => documentsApi.runOcr(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
  });

  const reindexMutation = useMutation({
    mutationFn: () => documentsApi.reindex(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
  });
  const summaryMutation = useMutation({
    mutationFn: (mode: 'short' | 'detailed' | 'key_points' | 'all') =>
      aiApi.generateSummary(id, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
  });

  const mindMapMutation = useMutation({
    mutationFn: () => aiApi.generateMindMap(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
  });

  const translateMutation = useMutation({
    mutationFn: () => aiApi.translate(id, targetLang, sourceLang),
    onSuccess: (data: any) => setTranslationResult(data.translation),
  });

  const askMutation = useMutation({
    mutationFn: async (content: string) => {
      const conversation =
        activeConversation ||
        (await conversationsApi.create({
          title: content.slice(0, 60),
          scope: 'document',
          documentId: id,
        }));
      return conversationsApi.sendMessage(conversation._id, { question: content, documentId: id });
    },
    onSuccess: () => {
      setQuestion('');
      qc.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
      qc.invalidateQueries({ queryKey: ['conversations', 'document', id] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: (newName: string) => documentsApi.rename(id, newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', id] });
      setIsEditingName(false);
    },
    onError: () => {
      // keep editing open so user can fix name
    },
  });

  const downloadTranslationAsPdf = async () => {
    if (!translationResult || !doc) return;
    setIsGeneratingPdf(true);
    
    try {
      const isArabic = targetLang === 'Arabic' || targetLang === 'ar';
      const direction = isArabic ? 'rtl' : 'ltr';
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) throw new Error("Popup blocked");
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="${targetLang}">
          <head>
            <title>Traduction - ${doc.originalName}</title>
            <style>
              body {
                font-family: ${isArabic ? 'system-ui, sans-serif' : 'Inter, system-ui, sans-serif'};
                padding: 40px;
                line-height: 1.8;
                color: #000;
                max-width: 800px;
                margin: 0 auto;
              }
              h1 {
                font-size: 20px;
                color: #1a1a1a;
                margin-bottom: 24px;
                padding-bottom: 12px;
                border-bottom: 1px solid #eaeaea;
              }
              .meta {
                font-size: 12px;
                color: #666;
                margin-bottom: 32px;
              }
              .content {
                white-space: pre-wrap;
                font-size: 14px;
              }
              @media print {
                @page { margin: 20mm; }
                body { padding: 0; max-width: none; }
              }
            </style>
          </head>
          <body dir="${direction}">
            <h1>${doc.originalName}</h1>
            <div class="meta">Langue cible : ${targetLang}</div>
            <div class="content">${translationResult}</div>
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const canGenerateMindMap = !!doc?.extractedText && doc.extractedText.length > 200;
  const canTranslate = !!doc?.extractedText && doc.extractedText.length > 50;
const summaryData = useMemo<SummaryPayload>(
    () => ({
      short: doc?.summaryShort || '',
      detailed: doc?.summaryDetailed || doc?.summary || '',
      keyPoints: doc?.summaryBullets || [],
    }),
    [doc]
  );

  const mindMapData = useMemo(() => doc?.mindMap as any, [doc]);

  const translatedText = useMemo(() => {
    return doc?.translations?.find((t) => t.language === targetLang)?.text || '';
  }, [doc, targetLang]);

  const targetLanguageLabel = useMemo(() => {
    return translationLanguages.find((l) => l.value === targetLang)?.label || targetLang;
  }, [targetLang]);

  const activeTranslation = useMemo(() => {
    return doc?.translations?.find((t) => t.language === targetLang);
  }, [doc, targetLang]);

  const activeAssistantMessage = useMemo(() => {
    const messages = activeConversation?.messages || [];
    return [...messages].reverse().find((m) => m.role === 'assistant');
  }, [activeConversation]);

  const previewUrl = getDocumentPreviewUrl(doc?.filename);
  const originalFileUrl =
    doc?.filename
      ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/uploads/${doc.filename}`
      : null;
  const originalViewerUrl = doc?.filename ? `/original/${encodeURIComponent(doc.filename)}` : null;
  const isSpreadsheet = isSpreadsheetDocument(doc);
  const isImage = (doc?.mimeType || '').toLowerCase().includes('image');
  const isDocx =
    ((doc?.mimeType || '').toLowerCase().includes('word') ||
      (doc?.mimeType || '').toLowerCase().includes('officedocument.wordprocessingml') ||
      (doc?.originalName || '').toLowerCase().endsWith('.docx') ||
      (doc?.originalName || '').toLowerCase().endsWith('.doc')) &&
    !isSpreadsheet;
  const translationPipeTable = useMemo(
    () => (isSpreadsheet && translationResult ? parsePipeTable(translationResult) : null),
    [isSpreadsheet, translationResult]
  );
  const highlightTerms =
    activeAssistantMessage?.highlights?.flatMap((h) => h.matchedTerms) || [];

  if (isLoading || !doc) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="font-semibold text-lg text-slate-900 dark:text-slate-100">Document introuvable</h2>
          <p className="text-slate-500 mt-2 text-sm">
            Le document que vous cherchez n'existe pas ou a été supprimé.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/documents')}>
            Retour aux documents
          </Button>
        </div>
      </AppLayout>
    );
  }

  const openSourcePage = (pageNumber?: number) => {
    const url = getDocumentPreviewUrl(doc.filename, pageNumber);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const TABS = [
    { id: 'overview', label: 'Aperçu', icon: BookOpen },
    { id: 'highlights', label: 'Passages', icon: Highlighter },
    { id: 'summary', label: 'Résumés', icon: Sparkles },
    { id: 'mind_map', label: 'Carte mentale', icon: GitBranch },
    ...(isSpreadsheet ? ([{ id: 'charts', label: 'Graphiques', icon: BarChart3 }] as const) : []),
    { id: 'translation', label: 'Traduction', icon: Languages },
    { id: 'chat', label: 'Chat IA', icon: FileSearch },
  ] as const;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/documents')}>
            <ArrowLeft className="w-4 h-4" />
            Documents
          </Button>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="truncate max-w-[260px] text-sm font-semibold text-slate-700 dark:text-slate-200">
            {doc.originalName}
          </span>
        </div>

        {/* Hero card */}
        <Card className="overflow-hidden border-surface-200 bg-gradient-to-br from-white via-surface-50 to-brand-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/20">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Left: meta + actions */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-500">
                Intelligence Documentaire
              </p>
              <div className="flex items-center gap-3 mt-2">
                {isEditingName ? (
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameMutation.mutate(editedName.trim());
                          if (e.key === 'Escape') {
                            setIsEditingName(false);
                            setEditedName(doc.originalName);
                          }
                        }}
                        autoFocus
                        className="h-11 w-full max-w-[560px] rounded-2xl border border-surface-200 bg-white px-4 text-base font-extrabold text-slate-900 shadow-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                      />
                      <Button
                        size="sm"
                        onClick={() => renameMutation.mutate(editedName.trim())}
                        isLoading={renameMutation.isPending}
                        disabled={!editedName.trim() || editedName.trim() === doc.originalName || renameMutation.isPending}
                        className="h-11"
                      >
                        <Check className="w-4 h-4" />
                        Enregistrer
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setIsEditingName(false);
                          setEditedName(doc.originalName);
                        }}
                        className="h-11"
                      >
                        <X className="w-4 h-4" />
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 break-words">
                      {doc.originalName}
                    </h1>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-surface-200 bg-white/70 text-slate-500 shadow-sm hover:bg-white hover:text-brand-700 hover:border-brand-200 transition-all dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:text-brand-300"
                      title="Modifier le nom"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <QRTrigger 
                  title="Mobile View" 
                  description="Continue reading this document on your phone. Perfect for reading on the go!"
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={doc.status} />
                <span className="rounded-full border border-surface-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-800">
                  {formatBytes(doc.size)}
                </span>
                <span className="rounded-full border border-surface-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-800">
                  {formatDate(doc.createdAt)}
                </span>
                {doc.pageCount && (
                  <span className="rounded-full border border-surface-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-800">
                    {doc.pageCount} page{doc.pageCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 items-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => ocrMutation.mutate()}
                  isLoading={ocrMutation.isPending}
                >
                  <Scan className="w-4 h-4" />
                  OCR
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => reindexMutation.mutate()}
                  isLoading={reindexMutation.isPending}
                >
                  <RefreshCw className="w-4 h-4" />
                  Réindexer
                </Button>
                {!doc.archived ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => archiveMutation.mutate()}
                    isLoading={archiveMutation.isPending}
                  >
                    <Archive className="w-4 h-4" />
                    Archiver
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => restoreMutation.mutate()}
                    isLoading={restoreMutation.isPending}
                  >
                    <Undo2 className="w-4 h-4" />
                    Restaurer
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => summaryMutation.mutate('all')}
                  isLoading={summaryMutation.isPending}
                >
                  <Sparkles className="w-4 h-4" />
                  Générer résumés
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDelete(true)}
                  className="shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
              </div>
            </div>

            {/* Right: stats + preview button */}
            <div className="space-y-4">
              <Card className="border-surface-200 bg-white/80 dark:bg-slate-800/60 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                  État IA
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    { label: 'Conversations', value: conversations.length },
                    { label: 'Pages', value: doc.pageCount ?? 'N/D' },
                    {
                      label: 'Résumé',
                      value: summaryData.detailed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-extrabold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Prêt
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold">Non généré</span>
                      ),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-500 dark:text-slate-400">{label}</span>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {(originalViewerUrl || originalFileUrl || previewUrl) && (
                <Card className="border-surface-200 bg-slate-950 text-white p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">
                    Document original
                  </p>
                  <p className="mt-2 text-sm font-medium text-white/70 leading-6">
                    Ouvrir le fichier source et naviguer vers les pages citées.
                  </p>
                  <a
                    href={isSpreadsheet ? (originalViewerUrl || '#') : (originalFileUrl || previewUrl || '#')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block"
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mt-4 border-white/10 bg-white/10 text-white hover:bg-white/20"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Ouvrir l'original
                    </Button>
                  </a>
                </Card>
              )}
            </div>
          </div>
        </Card>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-surface-200 bg-surface-100/80 dark:bg-slate-800/50 dark:border-slate-700 p-1.5">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setTab(tabId as DetailTab)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                tab === tabId
                  ? 'border border-surface-200 bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-brand-400'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:hover:bg-slate-700/60 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Overview tab ────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-surface-200">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Aperçu du document
              </h2>
              <div className="mt-4">
                {isSpreadsheet ? (
                  <SpreadsheetPreview doc={doc} />
                ) : isImage && previewUrl ? (
                  <ImagePreview url={previewUrl} originalName={doc.originalName} />
                ) : isDocx && previewUrl ? (
                  <DocxPreview url={previewUrl} />
                ) : doc.mimeType === 'application/pdf' && previewUrl ? (
                  <PdfPreview url={previewUrl} originalName={doc.originalName} />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-surface-200 bg-slate-50 text-sm font-medium text-slate-400">
                    Aperçu inline disponible pour les PDF, images et documents Word.
                  </div>
                )}
              </div>
            </Card>

            <Card className="border-surface-200">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Dernières preuves IA
              </h2>
              <div className="mt-4 space-y-3">
                {!activeAssistantMessage?.sources?.length ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm font-medium text-slate-400">
                    Posez une question dans l'onglet <strong>Chat IA</strong> pour générer des preuves avec sources.
                  </div>
                ) : (
                  activeAssistantMessage.sources.map((source, i) => (
                    <div
                      key={`${source.chunkId}-${i}`}
                      className="rounded-2xl border border-surface-200 bg-white dark:bg-slate-900 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {source.documentName}
                        </p>
                        <Button variant="ghost" size="sm" onClick={() => openSourcePage(source.pageNumber)}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs leading-6 text-slate-500 dark:text-slate-400 line-clamp-3">
                        {source.text}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-full bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Score {(source.score * 100).toFixed(1)}%
                        </span>
                        {source.pageNumber && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Page {source.pageNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── Highlights tab ──────────────────────────────────── */}
        {tab === 'highlights' && (
          <Card className="border-surface-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Passages pertinents
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Extraits mis en évidence à partir de la dernière réponse de l'assistant.
                </p>
              </div>
              {activeAssistantMessage?.sources?.[0]?.pageNumber && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openSourcePage(activeAssistantMessage.sources?.[0]?.pageNumber)}
                >
                  <ExternalLink className="w-4 h-4" />
                  Page citée
                </Button>
              )}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                {!activeAssistantMessage?.highlights?.length ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-sm text-center font-medium text-slate-400">
                    Aucun passage disponible. Posez d'abord une question dans Chat IA.
                  </div>
                ) : (
                  activeAssistantMessage.highlights.map((highlight, i) => (
                    <div
                      key={`${highlight.sourceIndex}-${i}`}
                      className="rounded-2xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/40 px-4 py-4"
                    >
                      <p
                        className="text-sm leading-7 text-slate-700 dark:text-slate-300"
                        dangerouslySetInnerHTML={{
                          __html: highlightText(highlight.snippet, highlight.matchedTerms),
                        }}
                      />
                    </div>
                  ))
                )}
              </div>

<div className="rounded-3xl border border-surface-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/80">
                <div className="mb-4 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{copy.documents.detail.highlights.extractedText}</p>
                </div>
                <div className="max-h-[720px] overflow-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-inner shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-950/80 dark:shadow-black/20">
                  <p
                    className="whitespace-pre-wrap text-sm font-medium leading-8 text-slate-900 dark:text-slate-100"
                    dangerouslySetInnerHTML={{
__html: highlightText(doc.extractedText || 'Aucun texte extrait disponible.', highlightTerms),
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {tab === 'summary' && (
          <Card className="border-surface-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.documents.detail.summary.title}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {copy.documents.detail.summary.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['short', 'detailed', 'key_points'] as SummaryView[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSummaryView(mode)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                      summaryView === mode
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-100 text-slate-600 hover:bg-surface-200'
                    }`}
                  >
                    {mode === 'short' ? copy.documents.detail.summary.modes.short : mode === 'detailed' ? copy.documents.detail.summary.modes.detailed : copy.documents.detail.summary.modes.keyPoints}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              {summaryView === 'key_points' ? (
                summaryData.keyPoints.length ? (
                  <div className="grid gap-3">
                    {summaryData.keyPoints.map((point, index) => (
                      <div key={index} className="rounded-2xl border border-surface-200 bg-white px-4 py-4 text-sm font-medium leading-7 text-slate-800 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                        {point}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySummary onGenerate={() => summaryMutation.mutate('all')} isLoading={summaryMutation.isPending} />
                )
              ) : summaryData[summaryView] ? (
                <div className="rounded-3xl border border-brand-500/15 bg-gradient-to-br from-brand-50/80 to-white px-6 py-6 text-sm font-medium leading-8 text-slate-800 dark:border-brand-500/25 dark:from-slate-950/90 dark:to-slate-900/90 dark:text-slate-100">
                  {summaryData[summaryView]}
                </div>
              ) : (
                <EmptySummary onGenerate={() => summaryMutation.mutate('all')} isLoading={summaryMutation.isPending} />
              )}

              {summaryMutation.isError && (
                <p className="mt-4 text-sm font-bold text-red-600">{getErrorMessage(summaryMutation.error)}</p>
              )}
            </div>
          </Card>
        )}

        {tab === 'mind_map' && (
          <Card className="border-surface-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.documents.detail.mindMap.title}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {copy.documents.detail.mindMap.description}
                </p>
              </div>
              <Button
                className="h-11 justify-center rounded-xl px-5 font-bold"
                onClick={() => mindMapMutation.mutate()}
                disabled={!canGenerateMindMap}
                isLoading={mindMapMutation.isPending}
              >
                <GitBranch className="w-4 h-4" />
                {mindMapData ? copy.documents.detail.mindMap.regenerate : copy.documents.detail.mindMap.generate}
              </Button>
            </div>

            <div className="mt-6">
              {!canGenerateMindMap ? (
                <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
                  <AlertTriangle className="mx-auto w-10 h-10 text-amber-500" />
                  <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{copy.documents.detail.mindMap.noText}</p>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {copy.documents.detail.mindMap.noTextHelper}
                  </p>
                </div>
              ) : mindMapMutation.isPending ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-surface-200 bg-surface-50">
                  <Spinner size="lg" />
                  <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                    {copy.documents.detail.mindMap.inProgress}
                  </p>
                </div>
              ) : mindMapData ? (
                <MindMapCanvas mindMap={mindMapData} />
              ) : (
                <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
                  <GitBranch className="mx-auto w-10 h-10 text-slate-300" />
                  <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{copy.documents.detail.mindMap.empty}</p>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {copy.documents.detail.mindMap.emptyHelper}
                  </p>
                </div>
              )}

              {mindMapMutation.isError && (
                <p className="mt-4 text-sm font-bold text-red-600">{getErrorMessage(mindMapMutation.error)}</p>
              )}
            </div>
          </Card>
        )}

        {/* ── Charts tab (Excel/CSV) ───────────────────────────── */}
        {tab === 'charts' && isSpreadsheet && <SpreadsheetCharts doc={doc} />}


        {/* ── Translation tab ─────────────────────────────────── */}
        {tab === 'translation' && (
          <Card className="border-surface-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Traduction du document
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Choisissez une langue cible et générez une version traduite du texte extrait.
                </p>
              </div>
            </div>

            {/* Language picker */}
            <div className="mt-6">
              <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 mb-2.5 block">
                LANGUE CIBLE
              </label>
              
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <select
                    value={targetLang}
                    onChange={(e) => {
                      setTargetLang(e.target.value as SupportedLang);
                      setTranslationResult(null);
                    }}
                    className="h-12 w-64 appearance-none rounded-2xl border border-surface-200 bg-white px-5 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 outline-none pr-10"
                  >
                    {translationLanguages.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    setTranslationResult(null);
                    translateMutation.mutate();
                  }}
                  isLoading={translateMutation.isPending}
                  disabled={!doc.extractedText || translateMutation.isPending}
                  className="h-12 px-6 shadow-lg shadow-brand-500/20"
                >
                  <Languages className="w-4 h-4" />
                  {translateMutation.isPending ? 'Traduction en cours…' : 'Traduire'}
                </Button>
              </div>
            </div>

            {/* No extracted text warning */}
            {!doc.extractedText && (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-5 py-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                    Texte non extrait
                  </p>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                    Lancez l'OCR sur ce document pour extraire le texte avant de le traduire.
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {translateMutation.isError && (
              <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {getErrorMessage(translateMutation.error)}
              </div>
            )}

            {/* Loading skeleton */}
            {translateMutation.isPending && !translationResult && (
              <div className="mt-6 space-y-3 animate-pulse">
                {[90, 80, 95, 70, 85].map((w, i) => (
                  <div
                    key={i}
                    className="h-4 rounded-full bg-slate-200 dark:bg-slate-700"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            )}

            {/* Translation result */}
            {translationResult && (
              <div className="mt-6">
                {/* Result header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      Traduit en{' '}
                      <span className="text-brand-600 dark:text-brand-400">
                        {targetLang}
                      </span>
                    </span>
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {translationResult.length.toLocaleString()} chars
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={downloadTranslationAsPdf}
                      disabled={isGeneratingPdf}
                      className="text-xs font-bold text-slate-400 hover:text-brand-600 transition-colors underline underline-offset-2 flex items-center gap-1 disabled:opacity-60 disabled:hover:text-slate-400"
                    >
                      {isGeneratingPdf ? <Spinner size="sm" /> : <Download className="w-3 h-3" />}
                      Télécharger en PDF
                    </button>
                    <button
                      onClick={() => {
                        const blob = new Blob([translationResult], { type: 'text/plain;charset=utf-8' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${doc.originalName.replace(/\.[^.]+$/, '')}_${targetLang}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-brand-600 transition-colors underline underline-offset-2 flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3" />
                      Télécharger en .txt
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(translationResult);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all border border-transparent hover:border-brand-200"
                    >
                      <ClipboardCopy className="w-3.5 h-3.5" />
                      {copied ? 'Copié !' : 'Copier'}
                    </button>
                  </div>
                </div>

                {/* Text area */}
                {isSpreadsheet ? (
                  translationPipeTable ? (
                    <TranslationSpreadsheetTable parsed={translationPipeTable} />
                  ) : (
                    <div
                      ref={translationRef}
                      dir={targetLang === 'Arabic' || targetLang === 'ar' ? 'rtl' : 'ltr'}
                      className={`max-h-[600px] overflow-y-auto rounded-2xl border border-surface-200 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-6 text-sm leading-8 text-slate-700 dark:text-slate-200 whitespace-pre-wrap ${
                        targetLang === 'Arabic' || targetLang === 'ar'
                          ? 'font-[system-ui] text-base tracking-normal'
                          : ''
                      }`}
                      style={targetLang === 'Arabic' || targetLang === 'ar' ? { fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif' } : {}}
                    >
                      {translationResult}
                    </div>
                  )
                ) : (
                  <div
                    ref={translationRef}
                    dir={targetLang === 'Arabic' || targetLang === 'ar' ? 'rtl' : 'ltr'}
                    className={`max-h-[600px] overflow-y-auto rounded-2xl border border-surface-200 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-6 text-sm leading-8 text-slate-700 dark:text-slate-200 whitespace-pre-wrap ${
                      targetLang === 'Arabic' || targetLang === 'ar'
                        ? 'font-[system-ui] text-base tracking-normal'
                        : ''
                    }`}
                    style={targetLang === 'Arabic' || targetLang === 'ar' ? { fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif' } : {}}
                  >
                    {translationResult}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ── Chat tab ────────────────────────────────────────── */}
        {tab === 'chat' && (
          <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
            {/* Conversation sidebar */}
            <Card className="border-surface-200 h-fit">
              <div className="flex items-center justify-between">
                <div>
<p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{copy.documents.detail.chat.history}</p>
                  <h2 className="mt-2 text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.documents.detail.chat.threads}</h2>
                </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const conversation = await conversationsApi.create({
                        title: copy.documents.detail.chat.new + ' ' + (conversations.length + 1),
                        scope: 'document',
                        documentId: id,
                      });
                      setSelectedConversationId(conversation._id);
                      qc.invalidateQueries({ queryKey: ['conversations', 'document', id] });
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                    {copy.documents.detail.chat.new}
                  </Button>
              </div>

              <div className="mt-5 space-y-3">
                  {conversations.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-6 text-sm font-medium text-slate-500">
                      {copy.documents.detail.chat.noConversations}
                    </div>
                  ) : (
                  conversations.map((conversation: Conversation) => (
                    <button
                      key={conversation._id}
                      onClick={() => setSelectedConversationId(conversation._id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                        selectedConversationId === conversation._id
                          ? 'border-brand-500/30 bg-brand-50/80 dark:bg-brand-500/20 shadow-sm'
                          : 'border-surface-200 bg-white dark:bg-slate-900/40 hover:border-brand-500/20 hover:bg-surface-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {conversation.title}
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        {formatDate(conversation.lastMessageAt)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </Card>

            {/* Chat panel */}
            <div className="space-y-3">
              <ConversationPanel
                conversation={activeConversation || null}
                question={question}
                onQuestionChange={setQuestion}
                onSend={() => askMutation.mutate(question)}
                isSending={askMutation.isPending}
placeholder={copy.documents.detail.chat.placeholder}
                emptyTitle={copy.documents.detail.chat.assistant}
                emptyDescription={copy.documents.detail.chat.description}
              />

              {askMutation.isError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {getErrorMessage(askMutation.error)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
        title={copy.documents.detail.deleteTitle}
        message={copy.documents.detail.deleteMessage}
        confirmLabel={copy.documents.detail.deleteConfirm}
        danger
      />
    </AppLayout>
  );
}
const EmptySummary = ({
  onGenerate,
  isLoading,
}: {
  onGenerate: () => void;
  isLoading?: boolean;
}) => {
  const { copy } = useLanguage();
  return (
    <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
      <FileText className="mx-auto w-10 h-10 text-slate-300" />
      <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{copy.documents.detail.summary.empty}</p>
      <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
        {copy.documents.detail.summary.emptyHelper}
      </p>
      <button
        className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition-all disabled:opacity-50"
        onClick={onGenerate}
        disabled={isLoading}
      >
        <Sparkles className="w-4 h-4" />
        {copy.documents.detail.summary.generate}
      </button>
    </div>
  );
};

const MindMapCanvas = ({ mindMap }: { mindMap: MindMapPayload }) => {
  const root: MindMapNode = mindMap.root || {
    title: mindMap.title,
    summary: mindMap.summary,
    children: [],
  };
  const branches = root.children || [];

  return (
    <div className="rounded-3xl border border-surface-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-3xl rounded-3xl border border-cyan-500/25 bg-cyan-500 px-5 py-5 text-slate-950 shadow-xl shadow-cyan-500/10 dark:bg-cyan-400">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-white/80 p-2 text-cyan-700">
            <GitBranch className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-black leading-tight">{root.title || mindMap.title}</p>
            {(root.summary || mindMap.summary) && (
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-800">
                {root.summary || mindMap.summary}
              </p>
            )}
          </div>
        </div>
      </div>

      {branches.length > 0 && (
        <>
          <div className="mx-auto h-8 w-px bg-cyan-500/40" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((branch, index) => (
              <MindMapBranch key={`${branch.title}-${index}`} branch={branch} index={index} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const mindMapColors = [
  'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100',
  'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
  'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
  'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100',
  'border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100',
];

const MindMapBranch = ({
  branch,
  index,
}: {
branch: MindMapNode;
  index: number;
}) => {
  const children = branch.children || [];
  const colorClass = mindMapColors[index % mindMapColors.length];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${colorClass}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80 text-sm font-black shadow-sm dark:bg-white/10">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-base font-black leading-snug">{branch.title}</p>
          {branch.summary && (
            <p className="mt-2 text-sm font-semibold leading-6 opacity-75">
              {branch.summary}
            </p>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div className="mt-4 space-y-2">
          {children.map((child, childIndex) => (
            <MindMapChild key={`${child.title}-${childIndex}`} node={child} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
};

const MindMapChild = ({ node, depth }: { node: MindMapNode; depth: number }) => {
  const children = node.children || [];

  return (
    <div className={`${depth > 0 ? 'ml-4 border-l border-current/20 pl-3' : ''}`}>
      <div className="rounded-xl border border-current/10 bg-white/70 px-3 py-2 text-slate-800 shadow-sm dark:bg-slate-950/40 dark:text-slate-100">
        <p className="text-sm font-black leading-snug">{node.title}</p>
        {node.summary && (
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
            {node.summary}
          </p>
        )}
      </div>

      {children.length > 0 && depth < 2 && (
        <div className="mt-2 space-y-2">
          {children.map((child, index) => (
            <MindMapChild key={`${child.title}-${index}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}

      {children.length > 0 && depth >= 2 && (
        <p className="mt-2 rounded-lg bg-white/50 px-3 py-2 text-xs font-bold opacity-70 dark:bg-white/5">
          + {children.length}
        </p>
      )}
    </div>
  );
};
