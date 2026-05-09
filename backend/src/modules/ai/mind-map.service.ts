import { DocumentModel } from '../documents/document.model';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { chatCompletionWithRetry } from '../../utils/llm';

export interface MindMapNode {
  title: string;
  summary?: string;
  children: MindMapNode[];
}

export interface MindMapPayload {
  title: string;
  summary?: string;
  root: MindMapNode;
  generatedAt: string;
}

const MAX_CONTEXT_CHARS = 12000;
const MAX_DEPTH = 3;
const MAX_ROOT_CHILDREN = 6;
const MAX_CHILDREN = 4;

const safeJsonParse = (text: string): any => {
  try {
    const cleaned = text.replace(/```json\s?|```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    }
  } catch (error) {
    logger.error('Failed to parse mind map JSON:', error);
  }
  return null;
};

const cleanText = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed || fallback;
};

const normalizeNode = (input: any, fallbackTitle: string, depth = 0): MindMapNode => {
  const title = cleanText(input?.title, fallbackTitle).slice(0, 90);
  const summary = cleanText(input?.summary, '').slice(0, 220);
  const maxChildren = depth === 0 ? MAX_ROOT_CHILDREN : MAX_CHILDREN;
  const rawChildren = Array.isArray(input?.children) ? input.children : [];

  return {
    title,
    ...(summary ? { summary } : {}),
    children:
      depth >= MAX_DEPTH
        ? []
        : rawChildren
            .slice(0, maxChildren)
            .map((child: any, index: number) => normalizeNode(child, `Idee ${index + 1}`, depth + 1)),
  };
};

const normalizeMindMap = (input: any, documentTitle: string): MindMapPayload => {
  const title = cleanText(input?.title, documentTitle).slice(0, 120);
  const summary = cleanText(input?.summary, '').slice(0, 260);
  const rootInput = input?.root || input;
  const root = normalizeNode(rootInput, title);

  return {
    title,
    ...(summary ? { summary } : {}),
    root: {
      ...root,
      title: root.title || title,
    },
    generatedAt: new Date().toISOString(),
  };
};

const generateMindMapJson = async (text: string, documentTitle: string): Promise<any> => {
  const response = await chatCompletionWithRetry({
    messages: [
      {
        role: 'system',
        content:
          'You are a document comprehension assistant. Create a mind map that helps a reader understand the document. ' +
          'Return ONLY valid JSON, no markdown and no preamble. Keep the language identical to the document language. ' +
          'Use at most 6 main branches, at most 4 children per branch, and at most 3 levels below the root. ' +
          'Every node needs a short "title" and may include a one-sentence "summary". ' +
          'JSON shape: {"title":"...","summary":"...","root":{"title":"...","summary":"...","children":[{"title":"...","summary":"...","children":[]}]}}',
      },
      {
        role: 'user',
        content: `Document title: ${documentTitle}\n\nDocument text:\n${text}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 1400,
    response_format: { type: 'json_object' },
  });

  return safeJsonParse(response);
};

const generateSegmentOutline = async (text: string, index: number, total: number): Promise<any> => {
  const response = await chatCompletionWithRetry({
    messages: [
      {
        role: 'system',
        content:
          'Extract the important concepts from this document segment for a future mind map. ' +
          'Return ONLY valid JSON with shape {"topics":[{"title":"...","summary":"...","children":[{"title":"...","summary":"..."}]}]}. ' +
          'Keep the language identical to the source text.',
      },
      {
        role: 'user',
        content: `Segment ${index + 1} of ${total}:\n\n${text}`,
      },
    ],
    temperature: 0.1,
    max_tokens: 900,
    response_format: { type: 'json_object' },
  });

  return safeJsonParse(response);
};

export const generateMindMap = async (documentId: string, ownerId: string): Promise<MindMapPayload> => {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new NotFoundError('Document');
  if (doc.ownerId.toString() !== ownerId) throw new ForbiddenError();

  if (!doc.extractedText || doc.extractedText.trim().length === 0) {
    throw new BadRequestError('Document has no extracted text. Run OCR first.');
  }

  const text = doc.extractedText.trim();
  let rawMindMap: any;

  if (text.length <= MAX_CONTEXT_CHARS) {
    logger.info(`Generating mind map for document ${documentId} in single pass`);
    rawMindMap = await generateMindMapJson(text, doc.originalName);
  } else {
    logger.info(`Generating mind map for document ${documentId} using map-reduce`);
    const segments: string[] = [];
    for (let start = 0; start < text.length; start += MAX_CONTEXT_CHARS) {
      segments.push(text.slice(start, start + MAX_CONTEXT_CHARS));
    }

    const outlines: any[] = [];
    for (let index = 0; index < segments.length; index += 1) {
      outlines.push(await generateSegmentOutline(segments[index], index, segments.length));
    }

    rawMindMap = await generateMindMapJson(JSON.stringify(outlines), doc.originalName);
  }

  const mindMap = normalizeMindMap(rawMindMap || {}, doc.originalName);

  await DocumentModel.findByIdAndUpdate(documentId, {
    mindMap,
    updatedAt: new Date(),
  });

  return mindMap;
};
