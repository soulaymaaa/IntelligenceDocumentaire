import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  User, Document, Dossier, DocumentFolder, DashboardStats, PaginationMeta,
  SearchResult, RagAnswer, ApiResponse, SummaryPayload, MindMapPayload, Conversation, RegisterResponse, ResendVerificationResponse, LoginResponse, ForgotPasswordResponse
} from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Use full backend URL in browser, relative path in SSR
const BASE_URL = typeof window !== 'undefined' ? `${API_BASE}/api` : `${API_BASE}/api`;

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

// --- Auth ---

export const authApi = {
  register: async (data: { name: string; email: string; password: string }) => {
    const res = await api.post<ApiResponse<RegisterResponse>>('/auth/register', data);
    return extractData(res);
  },

  login: async (data: { email: string; password: string }) => {
    const res = await api.post<ApiResponse<LoginResponse>>('/auth/login', data);
    const result = extractData(res);
    if (result.token) localStorage.setItem('auth_token', result.token);
    return result;
  },

  verifyEmail: async (data: { email: string; code: string }) => {
    const res = await api.post<ApiResponse<{ user: User; token: string }>>('/auth/verify-email', data);
    const result = extractData(res);
    if (result.token) localStorage.setItem('auth_token', result.token);
    return result;
  },

  resendVerification: async (email: string) => {
    const res = await api.post<ApiResponse<ResendVerificationResponse>>('/auth/resend-verification', { email });
    return extractData(res);
  },

  forgotPassword: async (email: string) => {
    const res = await api.post<ApiResponse<ForgotPasswordResponse>>('/auth/forgot-password', { email });
    return extractData(res);
  },

  verifyResetCode: async (data: { email: string; code: string }) => {
    await api.post('/auth/verify-reset-code', data);
  },

  loginWithResetCode: async (data: { email: string; code: string }) => {
    const res = await api.post<ApiResponse<LoginResponse>>('/auth/login-with-reset-code', data);
    const result = extractData(res);
    if (result.token) localStorage.setItem('auth_token', result.token);
    return result;
  },

  resetPassword: async (data: { email: string; code: string; newPassword: string }) => {
    await api.post('/auth/reset-password', data);
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    await api.post('/auth/change-password', data);
  },

  logout: async () => {
    localStorage.removeItem('auth_token');
    await api.post('/auth/logout');
  },

  me: async (): Promise<User> => {
    const res = await api.get<ApiResponse<{ user: User }>>('/auth/me');
    return extractData(res).user;
  },

  deleteAccount: async (): Promise<void> => {
    localStorage.removeItem('auth_token');
    await api.delete('/auth/delete-account');
  },
};

// --- Documents ---

export const documentsApi = {
  getDashboard: async (): Promise<DashboardStats> => {
    const res = await api.get<ApiResponse<DashboardStats>>('/documents/dashboard');
    return extractData(res);
  },

  list: async (params?: {
    page?: number; limit?: number; status?: string; search?: string; archived?: boolean; folderId?: string | null; dossierId?: string;
  }): Promise<{ documents: Document[]; meta: PaginationMeta }> => {
    const res = await api.get<ApiResponse<{ documents: Document[]; meta: PaginationMeta }>>(
      '/documents', { params }
    );
    return extractData(res);
  },

  listFolders: async (search?: string): Promise<{ folders: DocumentFolder[]; unfiledCount: number; documents?: Document[] }> => {
    const res = await api.get<ApiResponse<{ folders: DocumentFolder[]; unfiledCount: number }>>(
      '/documents/folders', { params: { search } }
    );
    return extractData(res);
  },

  createFolder: async (data: { name: string; color?: string }): Promise<DocumentFolder> => {
    const res = await api.post<ApiResponse<{ folder: DocumentFolder }>>('/documents/folders', data);
    return extractData(res).folder;
  },

  renameFolder: async (id: string, data: { name: string; color?: string }): Promise<DocumentFolder> => {
    const res = await api.patch<ApiResponse<{ folder: DocumentFolder }>>(`/documents/folders/${id}`, data);
    return extractData(res).folder;
  },

  deleteFolder: async (id: string): Promise<void> => {
    await api.delete(`/documents/folders/${id}`);
  },

  get: async (id: string): Promise<Document> => {
    const res = await api.get<ApiResponse<{ document: Document }>>(`/documents/${id}`);
    return extractData(res).document;
  },

  upload: async (
    files: File[],
    onProgress?: (pct: number) => void,
    folderId?: string | null
  ): Promise<Document[]> => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    if (folderId) formData.append('folderId', folderId);

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

  restore: async (id: string): Promise<Document> => {
    const res = await api.patch<ApiResponse<{ document: Document }>>(`/documents/${id}/restore`);
    return extractData(res).document;
  },

  rename: async (id: string, originalName: string): Promise<Document> => {
    const res = await api.patch<ApiResponse<{ document: Document }>>(`/documents/${id}/rename`, { originalName });
    return extractData(res).document;
  },

  moveToFolder: async (id: string, folderId: string | null): Promise<Document> => {
    const res = await api.patch<ApiResponse<{ document: Document }>>(`/documents/${id}/folder`, { folderId });
    return extractData(res).document;
  },

  runOcr: async (id: string): Promise<void> => {
    await api.post(`/documents/${id}/run-ocr`);
  },

  reindex: async (id: string): Promise<void> => {
    await api.post(`/documents/${id}/reindex`);
  },

  move: async (id: string, dossierId: string | null): Promise<Document> => {
    const res = await api.patch<ApiResponse<{ document: Document }>>(`/documents/${id}/move`, { dossierId });
    return extractData(res).document;
  },
};

// ── Dossiers ──────────────────────────────────────────────────────────────────

export const dossiersApi = {
  list: async (): Promise<Dossier[]> => {
    const res = await api.get<ApiResponse<{ dossiers: Dossier[] }>>('/dossiers');
    return extractData(res).dossiers;
  },

  create: async (name: string, color?: string): Promise<Dossier> => {
    const res = await api.post<ApiResponse<{ dossier: Dossier }>>('/dossiers', { name, color });
    return extractData(res).dossier;
  },

  update: async (id: string, updates: { name?: string; color?: string }): Promise<Dossier> => {
    const res = await api.patch<ApiResponse<{ dossier: Dossier }>>(`/dossiers/${id}`, updates);
    return extractData(res).dossier;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/dossiers/${id}`);
  },
};

// --- Search ---

export const searchApi = {
  semantic: async (query: string, topK = 5, documentId?: string): Promise<SearchResult[]> => {
    const res = await api.post<ApiResponse<{ results: SearchResult[] }>>('/search/semantic', {
      query, topK, documentId,
    });
    return extractData(res).results;
  },
};

// --- AI ---

export const aiApi = {
  generateSummary: async (
    id: string,
    mode: 'short' | 'detailed' | 'key_points' | 'all' = 'all'
  ): Promise<SummaryPayload> => {
    const res = await api.post<ApiResponse<{ summary: SummaryPayload }>>(`/ai/documents/${id}/summary`, { mode });
    return extractData(res).summary;
  },

  generateMindMap: async (id: string): Promise<MindMapPayload> => {
    const res = await api.post<ApiResponse<{ mindMap: MindMapPayload }>>(`/ai/documents/${id}/mind-map`);
    return extractData(res).mindMap;
  },

  ask: async (id: string, question: string, topK = 5, responseLanguage?: 'fr' | 'en'): Promise<RagAnswer> => {
    const res = await api.post<ApiResponse<RagAnswer>>(`/ai/documents/${id}/ask`, {
      question, topK, responseLanguage,
    });
    return extractData(res);
  },

  askGlobal: async (question: string, topK = 5, responseLanguage?: 'fr' | 'en'): Promise<RagAnswer> => {
    const res = await api.post<ApiResponse<RagAnswer>>('/ai/ask-global', { question, topK, responseLanguage });
    return extractData(res);
  },

  translate: async (
    id: string,
    targetLanguage: string,
    sourceLanguage: string | 'auto' = 'auto'
  ): Promise<{ translation: string }> => {
    const res = await api.post<ApiResponse<{ translation: string }>>(
      `/ai/documents/${id}/translate`,
      { targetLanguage, sourceLanguage },
      { timeout: 180000 }
    );
    return extractData(res);
  },
};

// --- Conversations ---

export const conversationsApi = {
  list: async (params?: { scope?: 'global' | 'document'; documentId?: string }): Promise<Conversation[]> => {
    const res = await api.get<ApiResponse<{ conversations: Conversation[] }>>('/conversations', { params });
    return extractData(res).conversations;
  },

  create: async (data?: {
    title?: string;
    scope?: 'global' | 'document';
    documentId?: string;
  }): Promise<Conversation> => {
    const res = await api.post<ApiResponse<{ conversation: Conversation }>>('/conversations', data || {});
    return extractData(res).conversation;
  },

  get: async (id: string): Promise<Conversation> => {
    const res = await api.get<ApiResponse<{ conversation: Conversation }>>(`/conversations/${id}`);
    return extractData(res).conversation;
  },

  sendMessage: async (
    id: string,
    payload: { question: string; topK?: number; documentId?: string; responseLanguage?: 'fr' | 'en' }
  ): Promise<{ conversation: Conversation; answer: RagAnswer }> => {
    const res = await api.post<ApiResponse<{ conversation: Conversation; answer: RagAnswer }>>(
      `/conversations/${id}/messages`,
      payload
    );
    return extractData(res);
  },
};

// --- Planner ---

export const plannerApi = {
  getTasks: async () => {
    const res = await api.get<ApiResponse<any[]>>('/planner');
    return extractData(res);
  },

  getStats: async () => {
    const res = await api.get<ApiResponse<any>>('/planner/stats');
    return extractData(res);
  },

  createTask: async (data: { text: string; date?: string; startDate?: string; endDate?: string; reminderAt?: string; priority?: string; category?: string }) => {
    const res = await api.post<ApiResponse<any>>('/planner', data);
    return extractData(res);
  },

  updateTask: async (id: string, data: { text?: string; completed?: boolean; date?: string; startDate?: string; endDate?: string; reminderAt?: string | null; priority?: string; category?: string }) => {
    const res = await api.put<ApiResponse<any>>(`/planner/${id}`, data);
    return extractData(res);
  },

  importExcel: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<ApiResponse<any>>('/planner/import-excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return extractData(res);
  },

  downloadTemplate: async () => {
    const res = await api.get('/planner/template', { responseType: 'blob' });
    return res.data as Blob;
  },

  deleteTask: async (id: string) => {
    await api.delete(`/planner/${id}`);
  },
};

// --- Admin Portal ---

export const adminPortalApi = {
  getUsers: async (params?: { page?: number; limit?: number; search?: string; role?: string }): Promise<{ users: User[]; meta: PaginationMeta }> => {
    const res = await api.get<ApiResponse<{ users: User[]; meta: PaginationMeta }>>('/admin-portal/users', { params });
    return extractData(res);
  },

  createUser: async (data: { name: string; email: string; role: 'user' | 'admin'; password?: string }): Promise<{ user: User }> => {
    const res = await api.post<ApiResponse<{ user: User }>>('/admin-portal/users', data);
    return extractData(res);
  },

  getMetrics: async (): Promise<{ totalUsers: number; activeUsers: number; deletedAccounts: number }> => {
    const res = await api.get<ApiResponse<{ totalUsers: number; activeUsers: number; deletedAccounts: number }>>('/admin-portal/metrics');
    return extractData(res);
  },

  updateUser: async (id: string, data: { role?: 'user' | 'admin'; isVerified?: boolean }): Promise<{ user: User }> => {
    const res = await api.put<ApiResponse<{ user: User }>>(`/admin-portal/users/${id}`, data);
    return extractData(res);
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/admin-portal/users/${id}`);
  },
};

export default api;
