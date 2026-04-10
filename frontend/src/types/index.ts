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
  summaryShort?: string;
  summaryDetailed?: string;
  summaryBullets?: string[];
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

export interface RagHighlight {
  sourceIndex: number;
  snippet: string;
  matchedTerms: string[];
}

export interface RagAnswer {
  answer: string;
  sources: RagSource[];
  hasAnswer: boolean;
  relevanceScore: number;
  confidence: 'high' | 'medium' | 'low';
  highlights: RagHighlight[];
}

export interface SummaryPayload {
  short: string;
  detailed: string;
  keyPoints: string[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  relevanceScore?: number;
  confidence?: 'high' | 'medium' | 'low';
  sources?: RagSource[];
  highlights?: RagHighlight[];
}

export interface Conversation {
  _id: string;
  title: string;
  scope: 'global' | 'document';
  documentId?: string;
  lastMessageAt: string;
  createdAt: string;
  messages: ConversationMessage[];
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

export interface RegisterResponse {
  user: User;
  devVerificationCode?: string;
  emailPreviewUrl?: string;
  deliveredToInbox: boolean;
}

export interface ResendVerificationResponse {
  devVerificationCode?: string;
  emailPreviewUrl?: string;
  deliveredToInbox: boolean;
}

export interface LoginChallengeResponse {
  user: User;
  devLoginCode?: string;
  emailPreviewUrl?: string;
  deliveredToInbox: boolean;
}

export interface ResendLoginCodeResponse {
  devLoginCode?: string;
  emailPreviewUrl?: string;
  deliveredToInbox: boolean;
}

export interface ForgotPasswordResponse {
  devResetCode?: string;
  emailPreviewUrl?: string;
  deliveredToInbox: boolean;
}

export interface DashboardStats {
  total: number;
  indexed: number;
  pending: number;
  errors: number;
  archived: number;
  recent: Document[];
  totalQueries: number;
  summariesGenerated: number;
  uploads: number;
  averageRelevanceScore: number;
  dailyActivity: Array<{ date: string; count: number }>;
  statusBreakdown: {
    indexed: number;
    pending: number;
    errors: number;
    archived: number;
  };
}
