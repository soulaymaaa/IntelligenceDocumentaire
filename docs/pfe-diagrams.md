# PFE Diagrams - Intelligence Documentaire

This file contains Mermaid diagrams you can reuse in your PFE report.

## 1. System Architecture

```mermaid
flowchart LR
  U[User] --> F[Frontend - Next.js App Router]
  F -->|REST /api| B[Backend - Express API]

  B --> A[Auth Module]
  B --> D[Document Module]
  B --> S[Search Module]
  B --> AI[AI Module]
  B --> O[OCR Module]
  B --> E[Embeddings Module]
  B --> R[RAG Module]
  B --> AU[Audit Module]

  D --> M[(MongoDB)]
  A --> M
  S --> M
  AI --> M
  O --> M
  E --> M
  R --> M
  AU --> M

  O --> T[Tesseract.js]
  O --> P[pdf-parse]
  E --> X[@xenova/transformers]
  AI --> LLM[LLM API]
  R --> LLM
  F --> C[UI components / Tailwind / i18n]
```

## 2. Global Use Case Diagram

> Version detaillee recommandee pour le rapport: [`docs/use-case-global.md`](use-case-global.md).

```mermaid
flowchart LR
  U([Authenticated User])
  A([Administrator])
  E([Email Service])
  O([OCR / Embedding / LLM Services])

  subgraph S[DocIntel System]
    UC1((Register / Login))
    UC2((Verify Email))
    UC3((Upload Document))
    UC4((View Document List))
    UC5((Open Document Details))
    UC6((Run OCR and Indexing))
    UC7((Search Documents Semantically))
    UC8((Ask AI Questions))
    UC9((Generate Summary))
    UC10((Archive / Delete Document))
    UC11((View Dashboard Stats))
    UC12((Track Audit Logs))
  end

  U --> UC1
  U --> UC2
  U --> UC3
  U --> UC4
  U --> UC5
  U --> UC7
  U --> UC8
  U --> UC9
  U --> UC10
  U --> UC11

  A --> UC11
  A --> UC12

  UC2 --> E
  UC6 --> O
  UC7 --> O
  UC8 --> O
  UC9 --> O
  UC3 --> UC6
  UC5 --> UC9
  UC5 --> UC8
  UC4 --> UC5
```

## 3. Document Processing Pipeline

```mermaid
sequenceDiagram
  actor User
  participant Frontend
  participant API as Backend API
  participant Docs as Document Service
  participant OCR as OCR Service
  participant Embed as Embedding Service
  participant DB as MongoDB

  User->>Frontend: Upload PDF / image
  Frontend->>API: POST /api/documents/upload
  API->>Docs: Create document record
  Docs->>DB: Save metadata (status=pending)
  API->>OCR: Trigger OCR processing
  OCR->>OCR: Native PDF text extraction or Tesseract OCR
  OCR->>Docs: Update extracted text and page count
  OCR->>Embed: Chunk text and generate embeddings
  Embed->>DB: Store chunks and vectors
  Embed->>Docs: Mark document as indexed
  Docs-->>Frontend: Document ready
  Frontend-->>User: Show status / dashboard update
```

## 4. Semantic Search And RAG

```mermaid
sequenceDiagram
  actor User
  participant Frontend
  participant API as Backend API
  participant Search as Search Service
  participant Embed as Embedding Service
  participant Rag as RAG Service
  participant DB as MongoDB
  participant LLM as LLM API

  User->>Frontend: Enter question
  Frontend->>API: POST /api/search/semantic or /api/ai/ask-global
  API->>Embed: Generate query embedding
  Embed->>DB: Load user chunks
  Embed-->>API: Ranked chunks by cosine similarity
  API->>Rag: Build context from top chunks
  Rag->>LLM: Ask grounded question with sources
  LLM-->>Rag: Generated answer
  Rag-->>API: Answer + cited sources
  API-->>Frontend: Render answer and references
  Frontend-->>User: Display grounded result
```

## 5. Data Model

```mermaid
erDiagram
  USER ||--o{ DOCUMENT : owns
  USER ||--o{ AUDIT_LOG : generates
  DOCUMENT ||--o{ DOCUMENT_CHUNK : contains

  USER {
    string name
    string email
    string passwordHash
    boolean isVerified
    string role
  }

  DOCUMENT {
    string filename
    string originalName
    string mimeType
    string status
    boolean archived
    string extractedText
    string summary
    int pageCount
  }

  DOCUMENT_CHUNK {
    string text
    int chunkIndex
    int tokenCount
    vector embedding
  }

  AUDIT_LOG {
    string action
    string resourceType
    string resourceId
    datetime createdAt
  }
```

## 6. Deployment View

```mermaid
flowchart LR
  Browser[Browser] --> FE[Frontend - Next.js]
  FE --> BE[Backend - Express API]
  BE --> DB[(MongoDB)]
  BE --> FS[(Local uploads folder)]
  BE --> OCR[Tesseract.js / pdf-parse]
  BE --> VEC[Embedding model]
  BE --> LLM[LLM provider]

  subgraph Docker Compose
    FE
    BE
    DB
  end
```

## Suggested report captions

- `Figure 1` - Global architecture of the document intelligence platform
- `Figure 2` - Global use case diagram of the system
- `Figure 3` - Document upload, OCR and indexing workflow
- `Figure 4` - Semantic search and RAG answer generation
- `Figure 5` - Simplified data model
- `Figure 6` - Deployment architecture
