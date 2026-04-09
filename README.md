# Document Intelligence Platform

A production-ready full-stack web application for intelligent document processing — powered by OCR, AI embeddings, semantic search, and RAG-based Q&A.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Secure Auth** | Register / login with JWT + bcrypt |
| **Document Upload** | Drag-and-drop PDF, JPG, PNG — up to 50 MB |
| **OCR Pipeline** | Tesseract.js extraction with native PDF text fallback |
| **Embeddings** | OpenAI `text-embedding-3-small` chunked indexing |
| **Semantic Search** | Cosine-similarity search across all user documents |
| **AI Summary** | Map-reduce summarization via `gpt-4o-mini` |
| **RAG Q&A** | Grounded answers with cited source chunks |
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
    embeddings/   OpenAI embeddings, chunking, cosine search
    ai/           Summarization (map-reduce)
    rag/          RAG Q&A with source citations
    search/       Semantic query endpoint
    audit/        Immutable action logs
  jobs/           Simple queue (swap for BullMQ+Redis in prod)
MongoDB            Documents, chunks (embeddings), users, audit logs
```

---

## 🚀 Quick Start (Local)

### Prerequisites

- Node.js 20+
- MongoDB running locally (`mongod`) or a MongoDB Atlas URI
- OpenAI API key (for embeddings, summaries, RAG)

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
# MONGODB_URI, JWT_SECRET, OPENAI_API_KEY

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
| `OPENAI_API_KEY` | ✅ | For embeddings, summaries, RAG |
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

1. **Vector Search**: Uses cosine similarity computed in-app. For production with large document sets (>10k chunks), use MongoDB Atlas Vector Search for performance.
2. **Job Queue**: Simple in-process queue — suitable for development. Replace with BullMQ + Redis for production resilience and horizontal scaling.
3. **File Storage**: Local disk storage. For production, swap to S3-compatible storage (abstraction point in `upload.middleware.ts`).
4. **OCR Quality**: Depends on document image quality and resolution. Low-resolution scans may produce poor results.
5. **OpenAI Required**: Embeddings and RAG require a valid OpenAI API key with billing enabled.
6. **Rate Limits**: AI endpoints are rate-limited (20 req/15 min per IP). Adjust in `.env` as needed.

---

## 🔮 Recommended Next Improvements

1. **MongoDB Atlas Vector Search** — Replace cosine similarity with proper ANN index for scale
2. **BullMQ + Redis** — Production-grade background jobs with retry/deadletter
3. **S3 File Storage** — Replace local uploads with AWS S3 or MinIO
4. **OCR Language Detection** — Auto-detect document language
5. **Multi-document RAG** — Explicit cross-document Q&A UI with document picker
6. **GDPR Export** — User data export endpoint
7. **Sharing** — Share documents with other users
8. **WebSocket Progress** — Real-time OCR progress via Server-Sent Events
9. **PDF Thumbnail Preview** — Visual document thumbnails in listings
10. **Admin Panel** — User management and system metrics
