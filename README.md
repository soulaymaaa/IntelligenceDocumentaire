# Document Intelligence Platform

A production-ready full-stack web application for intelligent document processing, powered by OCR, embeddings, semantic search, and RAG-based Q&A.

---

## 📖 Project Description

`IntelligenceDocumentaire` transforms uploaded files into searchable, AI-ready knowledge.

The platform allows each authenticated user to upload documents, extract text, build semantic indexes, search by meaning, generate summaries, and ask grounded questions with source citations.  
It is designed as a modular Next.js + Express + MongoDB architecture with a clear path from local development to production hardening.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Secure Auth** | Register / login with JWT + bcrypt |
| **Document Upload** | Drag-and-drop PDF, JPG, PNG — up to 50 MB |
| **OCR Pipeline** | Tesseract.js extraction with native PDF text fallback |
| **Embeddings** | Local `Xenova/all-MiniLM-L6-v2` chunked indexing |
| **Semantic Search** | MongoDB Atlas Vector Search (with cosine fallback) |
| **AI Summary** | Short / detailed / key-points summaries via Groq Llama 3.3 70B |
| **RAG Q&A** | Grounded answers with cited source chunks, confidence score, relevance % |
| **Conversational AI** | Persistent conversation threads scoped to a document or global |
| **Audit Logs** | Every upload, OCR, summary, and Q&A action logged |
| **User Isolation** | All data scoped to the authenticated user |
| **Docker Support** | Full docker-compose for local development |

---

## 🏗 Architecture

```
frontend/         Next.js 14 (App Router, TypeScript, Tailwind CSS)
backend/          Express.js REST API (TypeScript, Modular)
  modules/
    auth/         Register, login, JWT
    documents/    CRUD + ownership
    uploads/      Multer file handling
    ocr/          Tesseract.js + pdf-parse pipeline
    embeddings/   Local embeddings, chunking, Atlas vector search + fallback
    ai/           Summarization (map-reduce)
    rag/          RAG Q&A with source citations
    search/       Semantic query endpoint
    audit/        Immutable action logs
  jobs/           Simple queue (swap for BullMQ+Redis in prod)
MongoDB            Documents, chunks (embeddings), users, audit logs
```

---

## 🔄 Indexing Pipeline — How It Works

When a document is uploaded, the platform automatically runs a 4-stage pipeline that transforms the raw file into a searchable, AI-ready knowledge base.

### Stage 1 — OCR (Text Extraction)

| Input type | Method |
|---|---|
| **PDF with native text** | `pdf-parse` (direct text layer extraction — fast, lossless) |
| **Scanned PDF / image** | Tesseract.js OCR (configurable language, default `fra+eng`) |

The extracted text is stored on the `Document` record as `extractedText`. Page count is recorded when available.

### Stage 2 — Smart Chunking

The raw text is split into overlapping chunks before embedding. The chunker uses a **priority-based boundary detection** strategy:

```
1. Double-newline paragraph boundaries     ← preferred split point
2. Headings / numbered sections            ← force new chunk
3. Sentence-ending punctuation (. ! ?)     ← fallback within paragraph
4. Word boundary near CHUNK_SIZE           ← last resort
```

**Parameters (tuned for retrieval quality):**

| Parameter | Value | Rationale |
|---|---|---|
| `CHUNK_SIZE` | 600 chars | Small enough for precise retrieval |
| `CHUNK_OVERLAP` | 120 chars | Preserves cross-boundary context |
| `MIN_CHUNK_SIZE` | 80 chars | Drops uninformative tiny fragments |
| `EMBEDDING_BATCH_SIZE` | 8 chunks | Optimised for local CPU inference |

Tiny fragments (< 80 chars) are merged into the preceding chunk rather than stored as noise.

### Stage 3 — Embedding Generation

Each chunk is embedded using the **`Xenova/all-MiniLM-L6-v2`** model running entirely locally (no external API calls):

- Model type: Sentence transformer (384-dimensional dense vectors)
- Pooling: Mean-pooled, L2-normalised
- Text limit: 8 000 chars per chunk (model's effective window)
- Inference: Batched on CPU via the `@xenova/transformers` JS port

Embeddings and metadata (`documentId`, `ownerId`, `chunkIndex`, `tokenCount`) are stored in the `documentchunks` MongoDB collection.

### Stage 4 — Vector Search at Query Time

When the user asks a question:

1. The question is embedded with the **same model** (all-MiniLM-L6-v2).
2. **If `VECTOR_SEARCH_ENABLED=true`**: MongoDB Atlas `$vectorSearch` ANN lookup (fast at scale).
3. **Otherwise** (default): In-memory **cosine similarity** across all chunks owned by the user.
4. Results with similarity < **0.25** are filtered out — preventing irrelevant context from polluting the LLM prompt.
5. Top-K chunks are formatted as labelled context blocks and sent to the LLM.

### Conversational filtering

Before hitting the retrieval pipeline, the RAG service checks whether the message is **pure small-talk** (hi, hello, merci, etc.). These bypass document retrieval entirely and receive a lightweight conversational reply — so the LLM never dumps document content in response to a greeting.

### Summary generation (multi-format)

Summaries are generated in three formats in a single API call (`mode: "all"`):

| Format | Prompt strategy | Max tokens |
|---|---|---|
| **Short** | Executive summary, 2-4 sentences | 300 |
| **Detailed** | Full narrative, map-reduce for large docs | 1200 |
| **Key Points** | JSON array of 5-8 bullet points | 600 |

All three are persisted to `summaryShort`, `summaryDetailed`, and `summaryBullets` on the document.

---

## 🚀 Quick Start (Local)

### Prerequisites

- Node.js 20+
- MongoDB running locally (`mongod`) or a MongoDB Atlas URI
- One AI provider key (Groq or OpenRouter) or local Ollama (for summaries/RAG)

### 1. Clone and setup

```bash
git clone <repo>
cd IntelligenceDocumentaire
```

### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your values:
# MONGODB_URI, JWT_SECRET, and AI provider config

# Frontend
cp frontend/.env.example frontend/.env.local
```

### 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Seed demo data

```bash
cd backend && npm run seed
```

Demo credentials created:
- **User**: `demo@example.com` / `Demo1234!`
- **Admin**: `admin@example.com` / `Admin1234!`

### 5. Run development servers

Open **two terminals**:

```bash
# Terminal 1 — Backend API
cd backend && npm run dev
# Runs on http://localhost:3001

# Terminal 2 — Frontend
cd frontend && npm run dev
# Runs on http://localhost:3000
```

Visit **http://localhost:3000** and sign in with the demo account.

---

## 🐳 Docker (Production)

```bash
# Copy and fill env vars
cp .env.example .env
# Edit .env: JWT_SECRET, OPENAI_API_KEY

# Build and start all services
docker-compose up --build -d

# Seed data inside the container
docker exec intelligence_backend node dist/scripts/seed.js
```

Services:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- MongoDB: localhost:27017

---

## 📡 API Reference

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/logout` | Clear session |
| GET  | `/api/auth/me` | Current user |

### Documents
| Method | Path | Description |
|---|---|---|
| POST   | `/api/documents/upload` | Upload files (multipart) |
| GET    | `/api/documents` | List documents (pagination + filters) |
| GET    | `/api/documents/:id` | Get document detail |
| DELETE | `/api/documents/:id` | Delete document + embeddings |
| PATCH  | `/api/documents/:id/archive` | Archive |
| POST   | `/api/documents/:id/run-ocr` | Trigger OCR |
| POST   | `/api/documents/:id/reindex` | Re-embed document |
| GET    | `/api/documents/dashboard` | Stats for dashboard |

### Search & AI
| Method | Path | Description |
|---|---|---|
| POST | `/api/search/semantic` | Vector search across user docs |
| POST | `/api/ai/documents/:id/summary` | Generate/regenerate summary |
| POST | `/api/ai/documents/:id/ask` | RAG Q&A on one document |
| POST | `/api/ai/ask-global` | RAG Q&A across all documents |

---

## 🧪 Tests

```bash
cd backend

# Unit tests only (no MongoDB needed)
npm test -- tests/unit

# All tests (requires MongoDB)
MONGODB_URI=mongodb://localhost:27017/intelligence_test npm test
```

Test coverage:
- Auth service (register, login, error cases)
- Text chunking and cosine similarity utilities
- Auth API integration tests (register, login, /me)

---

## 📂 Project Structure

```
IntelligenceDocumentaire/
├── backend/
│   ├── src/
│   │   ├── app.ts                  Entry point
│   │   ├── config/                 env, database
│   │   ├── middleware/             auth, errorHandler, rateLimiter, requestLogger
│   │   ├── utils/                  logger, errors, helpers
│   │   └── modules/
│   │       ├── auth/               routes, controller, service
│   │       ├── users/              model
│   │       ├── documents/          model, routes, controller, service
│   │       ├── uploads/            multer middleware
│   │       ├── ocr/                ocr.service, ocr.queue
│   │       ├── embeddings/         chunk.model, embedding.service
│   │       ├── search/             controller, routes
│   │       ├── ai/                 summary.service, controller, routes
│   │       ├── rag/                rag.service
│   │       └── audit/              model, service
│   ├── scripts/seed.ts
│   ├── tests/
│   │   ├── unit/
│   │   └── integration/
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx          Root layout + fonts
│   │   │   ├── providers.tsx       React Query + Auth providers
│   │   │   ├── page.tsx            → redirect /dashboard
│   │   │   ├── (auth)/login/       Login page
│   │   │   ├── (auth)/register/    Register page
│   │   │   ├── dashboard/          Dashboard with stats
│   │   │   ├── documents/          Document list + [id] detail
│   │   │   └── search/             Semantic search + global Q&A
│   │   ├── components/
│   │   │   ├── layout/             Sidebar, TopBar, AppLayout
│   │   │   ├── ui/                 Button, Badge, Card, Input, Modal, Spinner, Toaster
│   │   │   └── documents/          DocumentCard, UploadZone
│   │   ├── lib/                    api.ts, auth-context.tsx, utils.ts
│   │   └── types/index.ts
│   ├── Dockerfile
│   └── .env.example
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Min 32 chars random secret |
| `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `OLLAMA_URL` | ⚠️ One option required | For summaries and RAG |
| `VECTOR_SEARCH_ENABLED` | | Enable MongoDB Atlas Vector Search (`true`/`false`) |
| `VECTOR_SEARCH_INDEX_NAME` | | Atlas vector index name (default: `document_chunks_vector_index`) |
| `PORT` | | Default: 3001 |
| `UPLOAD_DIR` | | Default: `./uploads` |
| `MAX_FILE_SIZE_MB` | | Default: 50 |
| `OCR_LANGUAGES` | | Default: `fra+eng` |
| `CORS_ORIGIN` | | Default: `http://localhost:3000` |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | | Default: `http://localhost:3001` |

---

## 🔎 MongoDB Atlas Vector Search Setup

1. Create an Atlas Search index on the `documentchunks` collection.
2. Use `embedding` as the indexed vector field with `numDimensions: 384` and `similarity: cosine`.
3. Set in `backend/.env`:
   - `VECTOR_SEARCH_ENABLED=true`
   - `VECTOR_SEARCH_INDEX_NAME=document_chunks_vector_index` (or your index name)
4. Restart the backend.

If Atlas vector search is not available or misconfigured, the backend automatically falls back to cosine similarity search.

---

## 🔒 Security Features

- JWT stored in httpOnly cookies + Authorization header fallback
- bcrypt password hashing (12 rounds)
- Rate limiting on auth (10 req/15 min) and AI endpoints (20 req/15 min)
- Helmet security headers
- User-scoped data access — users cannot access other users' documents
- Input validation with Zod on all endpoints
- File type and size validation on upload
- Sensitive data never returned in error messages (production)

---

## 📋 Assumptions & Known Limitations

1. **Vector Search**: Atlas Vector Search is supported when enabled; backend automatically falls back to in-app cosine similarity when unavailable.
2. **Job Queue**: Simple in-process queue — suitable for development. Replace with BullMQ + Redis for production resilience and horizontal scaling.
3. **File Storage**: Local disk storage. For production, swap to S3-compatible storage (abstraction point in `upload.middleware.ts`).
4. **OCR Quality**: Depends on document image quality and resolution. Low-resolution scans may produce poor results.
5. **AI Provider Required**: Summaries and RAG require at least one provider (Groq, OpenRouter, or local Ollama).
6. **Rate Limits**: AI endpoints are rate-limited (20 req/15 min per IP). Adjust in `.env` as needed.

---

## 🔮 Recommended Next Improvements

### High Priority (Do First)

1. **Frontend/Backend contract alignment**
   - Add missing `PATCH /api/documents/:id/restore` endpoint used by frontend.
   - Align summary payload shape between backend and frontend.
   - Align dashboard analytics fields expected by frontend.
2. **Authentication hardening**
   - Remove JWT storage in `localStorage` and prefer secure httpOnly cookie flow.
   - Add CSRF protection for cookie-based sessions.
3. **Integration tests for critical flows**
   - Add contract tests for archive/restore, summary response shape, and dashboard metrics.

### Medium Priority

4. **Scalable OCR queue**
   - Replace in-process queue with BullMQ + Redis for retries and resilience.
5. **Scalable semantic search**
   - Move from in-memory cosine comparisons to MongoDB Atlas Vector Search.
6. **Protected file delivery**
   - Replace public static upload exposure with controlled access (proxy or signed URL).
7. **Operational observability**
   - Add metrics for OCR duration, embedding latency, AI errors, and queue failures.

### Low Priority / Product Polish

8. **Documentation consistency**
   - Keep README and functionality docs aligned with real providers and API contracts.
9. **UI consistency**
   - Harmonize language and empty/loading states across pages.
10. **Repository hygiene**
   - Ignore generated artifacts (`.next`, temporary uploads) and keep commits clean.
