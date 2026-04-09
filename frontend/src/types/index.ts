export type DocumentStatus = 'pending' | 'processing_ocr' | 'indexed' | 'error' | 'archived';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  _id: string;
  ownerId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  status: DocumentStatus;
  extractedText?: string;
  pageCount?: number;
  summary?: string;
  archived: boolean;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  _id: string;
  documentId: string;
  ownerId: string;
  chunkIndex: number;
  pageNumber?: number;
  text: string;
  tokenCount: number;
  score?: number;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  text: string;
  chunkIndex: number;
  pageNumber?: number;
  score: number;
}

export interface RagSource {
  chunkId: string;
  documentId: string;
  documentName: string;
  text: string;
  chunkIndex: number;
  pageNumber?: number;
  score: number;
}

export interface RagAnswer {
  answer: string;
  sources: RagSource[];
  hasAnswer: boolean;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DashboardStats {
  total: number;
  indexed: number;
  pending: number;
  errors: number;
  archived: number;
  recent: Document[];
}
