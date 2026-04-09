import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  User, Document, DashboardStats, PaginationMeta,
  SearchResult, RagAnswer, ApiResponse
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}`
  : '';

// Use Next.js rewrites in production (relative), direct in dev
const BASE_URL = typeof window !== 'undefined' ? '/api' : `${API_BASE}/api`;

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token from localStorage as fallback
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-redirect on 401
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

const extractData = <T>(res: { data: ApiResponse<T> }): T => res.data.data;

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: async (data: { name: string; email: string; password: string }) => {
    const res = await api.post<ApiResponse<{ user: User }>>('/auth/register', data);
    return extractData(res);
  },

  verifyEmail: async (data: { email: string; code: string }) => {
    const res = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/verify-email', data);
    const result = extractData(res);
    if (result.token) localStorage.setItem('auth_token', result.token);
    return result;
  },

  resendVerification: async (email: string) => {
    await api.post('/auth/resend-verification', { email });
  },

  login: async (data: { email: string; password: string }) => {
    const res = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', data);
    const result = extractData(res);
    if (result.token) localStorage.setItem('auth_token', result.token);
    return result;
  },

  logout: async () => {
    localStorage.removeItem('auth_token');
    await api.post('/auth/logout');
  },

  me: async (): Promise<User> => {
    const res = await api.get<ApiResponse<{ user: User }>>('/auth/me');
    return extractData(res).user;
  },
};

// ── Documents ─────────────────────────────────────────────────────────────────

export const documentsApi = {
  getDashboard: async (): Promise<DashboardStats> => {
    const res = await api.get<ApiResponse<DashboardStats>>('/documents/dashboard');
    return extractData(res);
  },

  list: async (params?: {
    page?: number; limit?: number; status?: string; search?: string; archived?: boolean;
  }): Promise<{ documents: Document[]; meta: PaginationMeta }> => {
    const res = await api.get<ApiResponse<{ documents: Document[]; meta: PaginationMeta }>>(
      '/documents', { params }
    );
    return extractData(res);
  },

  get: async (id: string): Promise<Document> => {
    const res = await api.get<ApiResponse<{ document: Document }>>(`/documents/${id}`);
    return extractData(res).document;
  },

  upload: async (
    files: File[],
    onProgress?: (pct: number) => void
  ): Promise<Document[]> => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));

    const res = await api.post<ApiResponse<{ documents: Document[] }>>(
      '/documents/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        },
      }
    );
    return extractData(res).documents;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },

  archive: async (id: string): Promise<Document> => {
    const res = await api.patch<ApiResponse<{ document: Document }>>(`/documents/${id}/archive`);
    return extractData(res).document;
  },

  runOcr: async (id: string): Promise<void> => {
    await api.post(`/documents/${id}/run-ocr`);
  },

  reindex: async (id: string): Promise<void> => {
    await api.post(`/documents/${id}/reindex`);
  },
};

// ── Search ────────────────────────────────────────────────────────────────────

export const searchApi = {
  semantic: async (query: string, topK = 5, documentId?: string): Promise<SearchResult[]> => {
    const res = await api.post<ApiResponse<{ results: SearchResult[] }>>('/search/semantic', {
      query, topK, documentId,
    });
    return extractData(res).results;
  },
};

// ── AI ────────────────────────────────────────────────────────────────────────

export const aiApi = {
  generateSummary: async (id: string): Promise<string> => {
    const res = await api.post<ApiResponse<{ summary: string }>>(`/ai/documents/${id}/summary`);
    return extractData(res).summary;
  },

  ask: async (id: string, question: string, topK = 5): Promise<RagAnswer> => {
    const res = await api.post<ApiResponse<RagAnswer>>(`/ai/documents/${id}/ask`, {
      question, topK,
    });
    return extractData(res);
  },

  askGlobal: async (question: string, topK = 5): Promise<RagAnswer> => {
    const res = await api.post<ApiResponse<RagAnswer>>('/ai/ask-global', { question, topK });
    return extractData(res);
  },
};

export default api;
