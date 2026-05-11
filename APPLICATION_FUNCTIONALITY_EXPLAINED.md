# IntelligenceDocumentaire — Complete Feature Guide for Beginners

This document explains **every feature of this project** in plain language.  
You do not need prior experience with AI or backend development to understand it.  
Each section tells you what the feature does, why it exists, and how the code makes it happen step by step.

---

## Table of Contents

1. [What this application does](#1-what-this-application-does)
2. [Document Upload](#2-document-upload)
3. [OCR — Text Extraction](#3-ocr--text-extraction)
4. [Indexing — Embedding Pipeline](#4-indexing--embedding-pipeline)
5. [Groq API — How It Works in This Project](#5-groq-api--how-it-works-in-this-project)
6. [Semantic Search](#6-semantic-search)
7. [AI Summaries](#7-ai-summaries)
8. [RAG Chat — Asking Questions](#8-rag-chat--asking-questions)
9. [Conversation History](#9-conversation-history)
10. [Document Management (CRUD)](#10-document-management-crud)
11. [Audit Logs](#11-audit-logs)
12. [Dashboard & Statistics](#12-dashboard--statistics)
13. [Technology Stack](#13-technology-stack)
14. [Full End-to-End Data Flow](#14-full-end-to-end-data-flow)

---

## 1. What this application does

**IntelligenceDocumentaire** transforms uploaded files into a searchable, AI-powered knowledge base.

Imagine you have 50 PDF reports, CVs, or scanned contracts sitting in a folder.  
Finding information inside them is tedious. Asking questions about them is impossible with a basic search.

This platform solves that:

| Problem | Solution |
|---|---|
| Can't read text from scanned images | OCR extracts the text automatically |
| Keyword search misses synonyms | Semantic search understands meaning |
| Can't summarise 50-page reports quickly | AI generates short/detailed/bullet summaries |
| Want to ask "who signed this contract?" | RAG chat answers grounded on the actual document |
| Need a traceable history of AI queries | Audit logs record every action |

**The platform is built for one user at a time** — each person sees only their own documents.

---

## 2. Document Upload

### What it does

Accepts PDF, JPG, and PNG files (up to 50 MB), saves them to disk, and stores metadata in the database.

### How it works (step by step)

**Frontend**
1. User drags & drops or selects files in the upload zone.
2. The frontend sends a `POST /api/documents/upload` request with `multipart/form-data`.

**Backend**
1. **Multer** middleware receives the file stream.
2. The file is saved to `./uploads/<uuid>.<ext>` (UUID prevents filename collisions).
3. A `Document` record is created in MongoDB with:
   - `originalName` — the original file name
   - `mimeType` — `application/pdf` / `image/jpeg` / etc.
   - `size` — file size in bytes
   - `storagePath` — path on disk
   - `status: 'uploaded'` — beginning of the status lifecycle
   - `ownerId` — the authenticated user
4. The OCR job is **automatically queued** right after upload.

**Document status lifecycle**

```
uploaded → ocr_processing → ocr_completed → indexing → indexed
                          ↘ ocr_failed
                                            ↘ index_failed
```

### Key files
- [backend/src/modules/uploads/upload.middleware.ts](backend/src/modules/uploads/upload.middleware.ts)
- [backend/src/modules/documents/document.service.ts](backend/src/modules/documents/document.service.ts)

---

## 3. OCR — Text Extraction

### What it is

OCR stands for **Optical Character Recognition** — it reads text from images and scanned PDFs.

### Why it matters

A scanned document is just a photo. The computer cannot "read" it as text — it only sees pixels. OCR analyses those pixels and converts them to readable characters.

### How it works (step by step)

The system uses two methods depending on the file type:

**Method 1 — Native PDF text extraction (fast)**
- Used when the PDF already contains a text layer (e.g. a Word doc exported to PDF).
- Library: `pdf-parse`.
- Text is extracted directly from the PDF structure — no image processing needed.
- Result: fast (< 1 second) and 100% accurate.

**Method 2 — Tesseract.js OCR (for scanned files)**
- Used when `pdf-parse` returns empty or very little text, or when the file is a JPG/PNG.
- Library: `tesseract.js` (runs a full OCR engine in Node.js).
- Languages configured by `OCR_LANGUAGES` env variable (default: `fra+eng` = French + English).
- Process:
  1. Image is pre-processed (contrast, binarization).
  2. Tesseract analyses character shapes and outputs the recognised text.
- Result: slower (seconds to minutes depending on size/quality).

**After extraction**
- Extracted text is saved to `document.extractedText`.
- Status is updated to `ocr_completed`.
- The indexing job is automatically queued next.

### Limitations
- Low-resolution scans (below 150 DPI) produce unreliable results.
- Handwritten text is not supported.

### Key files
- [backend/src/modules/ocr/ocr.service.ts](backend/src/modules/ocr/ocr.service.ts)

---

## 4. Indexing — Embedding Pipeline

### What "indexing" means

Indexing = converting document text into numbers (vectors) that represent meaning, then storing those numbers in the database so they can be searched later.

This is what makes it possible to ask "what are the payment terms?" and get back the right passage — even if the document never uses the word "terms" but says "conditions de paiement".

---

### The 4 stages of indexing

```
Raw extracted text
        │
        ▼
Stage 1 — Normalise whitespace
        │
        ▼
Stage 2 — Split into chunks (smart boundary detection)
        │
        ▼
Stage 3 — Generate embedding vectors (local AI model)
        │
        ▼
Stage 4 — Save chunks + vectors to MongoDB
```

---

### Stage 1 — Text normalisation

Before splitting, the raw OCR text is cleaned:

```
Windows line endings (\r\n)  →  Unix (\n)
Tabs                         →  single space
3+ blank lines               →  exactly 1 blank line
Leading/trailing whitespace  →  removed
```

**Why**: OCR output often has messy whitespace. Normalising first ensures the chunker sees clean paragraph boundaries.

---

### Stage 2 — Smart chunking

The full text is split into small passages called **chunks**.

**Why chunks?** The embedding model has a size limit, and smaller chunks allow more precise retrieval. If you stored the whole document as one vector, every question would get the entire document back — useless.

**Configuration:**

| Parameter | Value | Meaning |
|---|---|---|
| `CHUNK_SIZE` | 600 chars | Target size of each chunk |
| `CHUNK_OVERLAP` | 120 chars | Characters re-used from the previous chunk |
| `MIN_CHUNK_SIZE` | 80 chars | Chunks smaller than this are merged or dropped |
| `EMBEDDING_BATCH_SIZE` | 8 | How many chunks to embed at once |

**The 3-level splitting strategy (priority order):**

**Level 1 — Paragraph split (preferred)**
Text is divided on double newlines (`\n\n`). This is the natural paragraph boundary and is always tried first.

**Level 2 — Heading detection**
If a paragraph starts with a heading (`# Title`, `1. Section`, `ALL-CAPS:`), a new chunk is forced immediately — even if the current buffer isn't full yet. This keeps each section self-contained.

**Level 3 — Sentence split (fallback)**
If a single paragraph is longer than 600 chars, it is split on sentence-ending punctuation (`.`, `!`, `?`). The split never happens mid-sentence.

**Level 4 — Word split (last resort)**
If a single sentence exceeds 600 chars (e.g. a long list), it is split at word boundaries. Never mid-word.

**After splitting:**

- Any chunk smaller than 80 chars is merged into the previous chunk (drops noise fragments like `"See table above."`).
- **Overlap is added**: the last 120 chars of chunk N are prepended to chunk N+1. This ensures sentences that cross a chunk boundary are still fully understood.

**Overlap example:**
```
Chunk 1: "...The contract was signed by Jean Dupont on 15 March 2024.
           The terms include a 12-month notice period."

Chunk 2: "...a 12-month notice period.   ← 120 chars overlap from chunk 1
           The salary is €85,000 per year, reviewed annually."
```
Without overlap, chunk 2 would start mid-thought. With overlap, the model understands the context.

---

### Stage 3 — Embedding generation (local model)

**Model used**: `Xenova/all-MiniLM-L6-v2`

This model runs **entirely on your machine** — no internet, no API key.

| Property | Value |
|---|---|
| Type | Sentence transformer |
| Output | 384 numbers per chunk |
| Max input | 8,000 chars |
| Pooling | Mean pooling (average of all word vectors) |
| Normalisation | L2-normalised (vector length = 1) |
| Library | `@xenova/transformers` (ONNX in Node.js) |

**What "384 numbers" means**: each chunk of text becomes a list of 384 floating-point numbers. Two chunks with similar meaning produce lists of numbers that are mathematically close to each other. This is how "payment terms" and "conditions de paiement" can match — their vectors are close even though the words are different.

**Batching**: 8 chunks are embedded in a single model call for efficiency. The model loads its weights once and processes 8 inputs simultaneously — much faster than 8 separate calls.

---

### Stage 4 — Saving to MongoDB

Each chunk is stored as one document in the `documentchunks` collection:

```
{
  documentId:  ObjectId   → which document this belongs to
  ownerId:     ObjectId   → which user owns it (data isolation)
  chunkIndex:  Number     → position in document (0, 1, 2, ...)
  pageNumber:  Number?    → PDF page if available
  text:        String     → the raw passage text
  embedding:   [Number]   → 384 floats (the vector)
  tokenCount:  Number     → approximate token count
  createdAt:   Date
}
```

Before indexing, all previous chunks for that document are deleted — so re-indexing always produces a clean result.

### Key files
- [backend/src/modules/embeddings/embedding.service.ts](backend/src/modules/embeddings/embedding.service.ts)
- [backend/src/modules/embeddings/chunk.model.ts](backend/src/modules/embeddings/chunk.model.ts)

---

## 5. Groq API — How It Works in This Project

### What Groq is

Groq is a cloud AI service that runs large language models (LLMs) extremely fast. It is **free to use** with an API key from [console.groq.com](https://console.groq.com).

In this project, Groq is the engine that **reads your document passages and writes the answer** in natural language.

### What Groq is NOT used for

Groq does **not** generate embeddings. It has no embeddings API.  
Embeddings are handled by the local `all-MiniLM-L6-v2` model (see section 4).

### The two distinct roles

```
Local model (all-MiniLM-L6-v2)          Groq API (llama-3.3-70b)
────────────────────────────────         ─────────────────────────────────
Converts text → numbers (vectors)        Reads passages → writes answers
Used for: indexing, search               Used for: chat answers, summaries
Needs: CPU only, no key                  Needs: GROQ_API_KEY
Runs: on your machine                    Runs: on Groq's servers
```

### How the Groq call is made

The project uses the OpenAI SDK pointed at Groq's API endpoint:

```typescript
groqClient = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',  // Groq uses the OpenAI-compatible API
});
```

This means the code looks identical to an OpenAI call — only the `baseURL` and `apiKey` differ.

### Models tried (in order)

When Groq is called, the system tries these models one by one until one succeeds:

```
1. llama-3.3-70b-versatile    ← best quality, tried first
2. llama-3.1-8b-instant       ← faster, smaller fallback
3. mixtral-8x7b-32768         ← good at multilingual content
4. gemma-2-9b-it              ← fallback
5. qwen-2.5-32b               ← last Groq fallback
```

If a model is rate-limited (too many requests), it automatically moves to the next one.

### Provider fallback chain

If all Groq models fail (rate limit, outage), the system tries the next provider:

```
Groq  →  OpenRouter (free models)  →  Ollama (local)
```

This means the app keeps working even if Groq is temporarily unavailable.

### Retry logic

For each model, the system retries up to 2 times with exponential backoff:

```
Attempt 1 fails → wait 2 seconds → Attempt 2 fails → wait 4 seconds → Attempt 3 → give up, try next model
```

### What Groq receives (for a RAG answer)

The system sends Groq **3 messages**:

```
Message 1 — system:
  Rules for the AI: answer only from context, keep same language,
  use markdown formatting, never echo the context back, etc.

Message 2 — user:
  [1] CV_Ala.pdf:
  Python, JavaScript, TypeScript, React, Node.js...

  [2] CV_Ala.pdf:
  Education: Bachelor in Computer Science...

  USER QUESTION: What programming languages does Ala know?
  ⚠️ Start your response IMMEDIATELY with the answer.

Message 3 — assistant (pre-seeded):
  "Based on **CV_Ala.pdf**,"
```

The third message (pre-seeded assistant) is a technique that forces Groq to **continue an existing answer** rather than repeat the question or re-state the context. This prevents the model from echoing back the document content instead of synthesizing an answer.

### What Groq receives (for a summary)

For summaries, Groq receives the document text and instructions to write in the document's own language. For large documents, the text is split into segments, each summarized separately, then combined in a final call.

### Configuration

Set in `backend/.env`:
```
GROQ_API_KEY=gsk_...yourkey...
```

Get a free key at: [console.groq.com](https://console.groq.com)

### Key files
- [backend/src/utils/llm.ts](backend/src/utils/llm.ts)
- [backend/src/config/env.ts](backend/src/config/env.ts)

---

## 6. Semantic Search

### What it is

Search by **meaning** rather than exact keywords.

Example:
- Keyword search for "car" would miss a document that says "automobile".
- Semantic search finds both because their vectors are similar.

### How it works (step by step)

1. User types a query and sends it to `POST /api/search/semantic`.
2. The backend embeds the query using the **same** local `all-MiniLM-L6-v2` model.
3. The backend compares the query vector against all chunk vectors owned by the user using **cosine similarity**.
4. Chunks with score below 0.25 are filtered out.
5. Top-K chunks are returned ordered by score.

**Optional: MongoDB Atlas Vector Search**

If `VECTOR_SEARCH_ENABLED=true`, the backend uses MongoDB Atlas's built-in ANN index — much faster at scale. If Atlas search fails, the backend automatically falls back to in-memory cosine similarity.

### Key files
- [backend/src/modules/search/search.controller.ts](backend/src/modules/search/search.controller.ts)

---

## 7. AI Summaries

### What it does

Generates three types of summary for a document in a single API call:

| Type | Description | Max tokens |
|---|---|---|
| **Short** | 2–4 sentence executive overview | 300 |
| **Detailed** | 3–6 paragraph full narrative | 1200 |
| **Key Points** | JSON array of 5–8 bullet points | 600 |

### How it works

**Endpoint**: `POST /api/ai/documents/:id/summary`

1. Backend loads `document.extractedText`.
2. All three summaries are generated **in parallel** (`Promise.all`) for speed.
3. Results are saved back to the document fields: `summaryShort`, `summaryDetailed`, `summaryBullets`.

**For large documents (map-reduce)**

If the document exceeds 12,000 characters:
1. Text is split into 12,000-char segments.
2. Each segment is summarised individually by Groq.
3. All partial summaries are sent to Groq again to produce one final combined summary.

**Groq is called for every summary** — it reads the text and writes the result in the same language as the document.

### Key files
- [backend/src/modules/ai/summary.service.ts](backend/src/modules/ai/summary.service.ts)

---

## 8. RAG Chat — Asking Questions

### What is RAG?

**RAG = Retrieval-Augmented Generation**

Instead of asking the AI to answer from its generic knowledge, we:
1. **Retrieve** relevant passages from the user's actual documents (using the local embedding model).
2. **Feed** those passages as context to Groq.
3. **Generate** an answer grounded in those passages.

### Endpoints
- Single document: `POST /api/ai/documents/:id/ask`
- All user documents: `POST /api/ai/ask-global`

### Full pipeline (step by step)

**Step 1 — Intent detection**
- **Small talk** ("hi", "merci", "bonjour") → skip document retrieval, give a friendly reply without calling Groq with document context.
- **Overview question** ("what is this document about?") → retrieve more chunks, answer in overview mode.
- **Specific question** ("who signed the contract?") → standard targeted retrieval.

**Step 2 — Retrieval** *(local model, no Groq)*
1. The question is embedded with `all-MiniLM-L6-v2`.
2. Top-5 chunks are retrieved by cosine similarity.
3. Chunks below score 0.08 are dropped (very low threshold to allow broad questions).

**Step 3 — Chunk sanitisation**
OCR sometimes captures template text baked into PDFs (like `Question: Répondez en Français:`). The `sanitiseChunk()` function strips these "poison lines" before they reach Groq.

**Step 4 — Build prompt**
Context is formatted as labelled source blocks and sent to Groq with strict instructions (see section 5 for the exact message structure).

**Step 5 — Groq generates the answer**
Groq reads the passages and writes a markdown-formatted answer citing the most relevant facts.

**Step 6 — Post-processing**
The raw Groq response is cleaned: any echoed context labels or noise lines are stripped. Only clean prose reaches the user.

**Step 7 — Scoring**
- `relevanceScore` (0–100%): average similarity of the top sources.
- `confidence`: `high` (≥ 0.6) / `medium` (≥ 0.4) / `low` (below that).

**Final response:**
```json
{
  "answer": "Based on CV_Ala.pdf, Ala knows Python, JavaScript, TypeScript...",
  "sources": [{ "documentName": "CV_Ala.pdf", "text": "...", "score": 0.82 }],
  "relevanceScore": 78,
  "confidence": "high",
  "hasAnswer": true
}
```

### Key files
- [backend/src/modules/rag/rag.service.ts](backend/src/modules/rag/rag.service.ts)
- [backend/src/utils/llm.ts](backend/src/utils/llm.ts)

---

## 9. Conversation History

### What it does

Saves full chat threads so users can return to previous conversations. Each conversation can be scoped to a specific document or span all documents.

### Scopes

| Scope | Meaning |
|---|---|
| `document` | Questions about one specific document |
| `global` | Questions across all user documents |

### How it works

**Sending a message** (`POST /api/conversations/:id/messages`)
1. User's question is appended to `messages[]` as `{ role: 'user', content, createdAt }`.
2. The RAG pipeline runs (Groq generates the answer).
3. The AI response is appended with `{ role: 'assistant', content, relevanceScore, confidence, sources, highlights }`.
4. If the conversation has no custom title yet, it auto-titles from the first question.

**On the frontend**
- User messages: right-aligned, brand-colour bubble.
- AI messages: left-aligned, white bubble with source cards and confidence badges.
- Markdown is rendered (bold, headers, bullet lists).
- Chat input is pinned at the bottom with auto-scroll on new messages.

### Key files
- [backend/src/modules/conversations/conversation.service.ts](backend/src/modules/conversations/conversation.service.ts)
- [frontend/src/components/ai/ConversationPanel.tsx](frontend/src/components/ai/ConversationPanel.tsx)

---

## 10. Document Management (CRUD)

### Actions available

| Action | Endpoint | What it does |
|---|---|---|
| Upload | `POST /api/documents/upload` | Upload new file(s) |
| List | `GET /api/documents` | List all documents |
| Detail | `GET /api/documents/:id` | Get full metadata + summary + status |
| Archive | `PATCH /api/documents/:id/archive` | Soft-delete (hidden but not removed) |
| Restore | `PATCH /api/documents/:id/restore` | Un-archive a document |
| Delete | `DELETE /api/documents/:id` | Permanently delete document + all chunks |
| Run OCR | `POST /api/documents/:id/run-ocr` | Re-run text extraction |
| Reindex | `POST /api/documents/:id/reindex` | Re-generate all embeddings |

### PDF Preview

The document detail page shows a PDF in an embedded `<iframe>` pointing to the backend static file URL.

### Key files
- [backend/src/modules/documents/document.service.ts](backend/src/modules/documents/document.service.ts)
- [frontend/src/app/documents/[id]/page.tsx](frontend/src/app/documents/%5Bid%5D/page.tsx)

---

## 11. Audit Logs

### What it does

Records an immutable log of every significant action.

Every action creates an `AuditLog` entry:
```
{
  userId,
  action,       ← e.g. "document_upload", "ocr_completed", "rag_query"
  resourceId,
  metadata,
  createdAt
}
```

Logged events: upload, OCR start/success/failure, embedding success/failure, summary generation, RAG query, document archive/restore/delete.

### Key files
- [backend/src/modules/audit/audit.service.ts](backend/src/modules/audit/audit.service.ts)

---

## 12. Dashboard & Statistics

Shows the user an overview: total documents, documents by status, recent uploads, storage used.

The frontend calls `GET /api/documents/dashboard` which runs a MongoDB aggregation and returns counts grouped by status.

---

## 13. Technology Stack

### Backend

| Layer | Technology | Role |
|---|---|---|
| Runtime | Node.js 20 | JavaScript server environment |
| Framework | Express.js | HTTP routing and middleware |
| Language | TypeScript | Type-safe JavaScript |
| Database | MongoDB + Mongoose | Document storage |
| Authentication | JWT + bcrypt | Secure login sessions |
| Validation | Zod | Input schema validation |
| File upload | Multer | Multipart file handling |
| OCR | pdf-parse + Tesseract.js | Text extraction from PDFs/images |
| Embeddings | @xenova/transformers | Local ML inference — no API needed |
| Embedding model | all-MiniLM-L6-v2 | 384-dim sentence vectors, runs locally |
| AI generation | **Groq** (primary) / OpenRouter / Ollama | LLM text generation for answers & summaries |
| Security | Helmet, CORS, rate-limiter | HTTP hardening |
| Logging | Winston | Structured server logs |

### Frontend

| Layer | Technology | Role |
|---|---|---|
| Framework | Next.js 14 (App Router) | React SSR/SPA framework |
| Language | TypeScript | Type-safe JavaScript |
| Styling | Tailwind CSS | Utility-first CSS |
| Data fetching | React Query | Server state management + caching |
| Markdown | react-markdown + remark-gfm | Render Groq responses as formatted text |
| Icons | Lucide React | SVG icon library |

---

## 14. Full End-to-End Data Flow

This section traces exactly what happens from upload to answered question.

---

### Phase 1 — Upload

```
User drops "CV_Ala.pdf"
    │
    └─► POST /api/documents/upload
          ├─ Multer saves file to disk
          ├─ MongoDB document created (status: "uploaded")
          └─ OCR job queued
```

---

### Phase 2 — OCR

```
OCR Job (background)
    ├─ Try pdf-parse (native text layer)
    │     ├─ text found → save extractedText, status = "ocr_completed"
    │     └─ empty → fallback to Tesseract.js OCR
    └─ Embedding job queued
```

---

### Phase 3 — Indexing *(local model only, no Groq)*

```
Embedding Job
    ├─ Normalise whitespace
    ├─ chunkText() → e.g. 4 chunks of ~580 chars each
    ├─ For each batch of 8 chunks:
    │     └─ all-MiniLM-L6-v2 → [384 numbers] per chunk
    ├─ DocumentChunk.insertMany([...])
    └─ document.status = "indexed"
```

---

### Phase 4 — Ask a Question *(local model for retrieval, Groq for the answer)*

```
User: "What programming languages does Ala know?"
    │
    ├─ Local model embeds the question → queryVector [384 numbers]
    │
    ├─ Cosine similarity against all user chunks:
    │     chunk_1 "Python, JS, TypeScript..."  score 0.82  ✓
    │     chunk_2 "Skills: React, Node.js..."  score 0.74  ✓
    │     chunk_3 "Education: Bachelor..."     score 0.31
    │
    ├─ Top 2 chunks sent to Groq as context
    │
    ├─ Groq (llama-3.3-70b) reads context and writes:
    │     "Based on **CV_Ala.pdf**, Ala is proficient in:
    │      - **Python** and **JavaScript/TypeScript**
    │      - Frameworks: React, Node.js, Express
    │      - Database: MongoDB, PostgreSQL"
    │
    └─ Response returned with sources, relevanceScore: 78%, confidence: "high"
```

---

### Phase 5 — Render in UI

```
AI bubble shows:
┌─────────────────────────────────────────────┐
│ Based on CV_Ala.pdf, Ala is proficient in:  │
│ • Python and JavaScript/TypeScript           │
│ • Frameworks: React, Node.js, Express        │
│ • Database: MongoDB, PostgreSQL              │
└─────────────────────────────────────────────┘
⚡ 78% pertinence   🛡 Confiance Haute
┌──────────────┐ ┌──────────────┐
│ Source 1 82% │ │ Source 2 74% │
│ CV_Ala.pdf   │ │ CV_Ala.pdf   │
└──────────────┘ └──────────────┘
```

---

## Environment Variables Quick Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Min 32 chars random secret |
| `GROQ_API_KEY` | ⚠️ recommended | Free key from console.groq.com — primary AI provider |
| `OPENROUTER_API_KEY` | optional | Fallback if Groq is unavailable |
| `OLLAMA_URL` | optional | Local Ollama fallback (default: http://localhost:11434) |
| `PORT` | optional | Default: 3001 |
| `UPLOAD_DIR` | optional | Default: ./uploads |
| `MAX_FILE_SIZE_MB` | optional | Default: 50 |
| `OCR_LANGUAGES` | optional | Default: fra+eng |
| `VECTOR_SEARCH_ENABLED` | optional | Enable MongoDB Atlas Vector Search |

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│  Upload document                                            │
│       ↓                                                     │
│  OCR extracts text  (pdf-parse or Tesseract.js)            │
│       ↓                                                     │
│  Local model splits + embeds text  (all-MiniLM-L6-v2)     │
│  → 384-dim vectors stored in MongoDB                        │
│       ↓                                                     │
│  User asks question                                         │
│       ↓                                                     │
│  Local model embeds question → cosine similarity search     │
│       ↓                                                     │
│  Top passages sent to Groq  (llama-3.3-70b)                │
│       ↓                                                     │
│  Groq writes answer with markdown + source citations        │
└─────────────────────────────────────────────────────────────┘

Local model = free, fast, always runs on your machine
Groq        = free API, writes the human-readable answers
```
