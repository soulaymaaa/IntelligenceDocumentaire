# How File Indexing Works — Detailed Explanation

This file explains exactly what happens when a document is indexed in this project.  
Everything below is derived from the actual code in `backend/src/modules/embeddings/`.

---

## What "indexing" means

When we say a document is **indexed**, it means:

1. Its text has been split into small passages (chunks).
2. Each passage has been converted to a list of numbers (embedding vector) that represents its *meaning*.
3. Those vectors are stored in MongoDB so they can be searched later.

This is what makes it possible to ask a question and get back the most relevant passages from your documents — even if the question uses different words than the document.

---

## The 4 stages of indexing

```
Raw text
   │
   ▼
Stage 1 ── Normalise whitespace
   │
   ▼
Stage 2 ── Split into chunks (smart boundary detection)
   │
   ▼
Stage 3 ── Generate embedding vectors (local AI model)
   │
   ▼
Stage 4 ── Save chunks + vectors to MongoDB
```

---

## Stage 1 — Text normalisation

**File**: `embedding.service.ts`, function `chunkText()`

Before splitting, the raw OCR text is cleaned:

```typescript
const normalised = text
  .replace(/\r\n/g, '\n')      // Windows line endings → Unix
  .replace(/\t/g, ' ')         // Tabs → single space
  .replace(/\n{3,}/g, '\n\n')  // 3+ blank lines → exactly 2 (one blank line)
  .trim();                      // Remove leading/trailing whitespace
```

**Why this matters**: OCR output often has inconsistent whitespace. Normalising first ensures the chunker sees clean paragraph boundaries.

---

## Stage 2 — Smart chunking

**File**: `embedding.service.ts`, functions `splitIntoRawChunks()`, `mergeSmallChunks()`, `addOverlap()`

### Configuration constants

```typescript
const CHUNK_SIZE         = 600;  // target characters per chunk
const CHUNK_OVERLAP      = 120;  // characters re-used from the previous chunk
const MIN_CHUNK_SIZE     = 80;   // chunks smaller than this are dropped/merged
const EMBEDDING_BATCH_SIZE = 8;  // how many chunks to embed at once
```

### Why 600 characters?

- Small enough to be precise: when searching, you get a focused passage, not a wall of text.
- Large enough to contain a complete thought (a paragraph or a few sentences).
- Fits comfortably inside the embedding model's effective window (8,000 chars max, but 600 is optimal for retrieval quality).

### The 3-level splitting strategy

The chunker tries to find the best split point, in priority order:

---

#### Level 1 — Paragraph split (preferred)

The text is first divided on double newlines (`\n\n`), which represent paragraph boundaries.

```typescript
const paragraphs = text.split(/\n\s*\n/);
```

For each paragraph:
- If it fits in the current buffer (combined size ≤ 600 chars) → append it.
- If adding it would exceed 600 chars → flush the buffer as a chunk, start fresh.

```
Document text:
┌──────────────────────────────────────────┐
│ Introduction paragraph (200 chars)        │ ─┐
│                                           │  │ combined = 200 + 180 = 380 ≤ 600
│ Background paragraph (180 chars)          │ ─┘  → stays in same chunk
│                                           │
│ Long methodology section (700 chars)      │ → too big, must split further
└──────────────────────────────────────────┘
```

---

#### Level 2 — Heading detection

Before merging paragraphs, the chunker checks if a paragraph starts with a heading:

```typescript
const isHeading = /^(#{1,6}\s|\d+\.\s|[A-Z][A-Z\s]{2,}:)/.test(trimmed);
```

This matches:
- Markdown headings: `# Title`, `## Section`, `### Subsection`
- Numbered sections: `1. Introduction`, `2. Methods`
- ALL-CAPS labels: `CONCLUSION:`, `RÉSULTATS:`

If a heading is detected and there is already content buffered, the buffer is flushed and the heading starts a new chunk. This keeps each section self-contained.

---

#### Level 3 — Sentence split (fallback for large paragraphs)

If a single paragraph is longer than 600 chars, the chunker splits it by sentences:

```typescript
const sentences = text.split(/(?<=[.!?])\s+/);
```

This uses a **lookbehind regex** — it splits only *after* a `.`, `!`, or `?` followed by whitespace. This means it never cuts mid-sentence.

Sentences are accumulated until the buffer would exceed 600 chars, then flushed.

---

#### Level 4 — Word split (last resort)

If a single sentence is longer than 600 chars (e.g. a list with no punctuation), the chunker falls back to word-boundary splitting:

```typescript
const words = text.split(/\s+/);
```

Words are added one by one until the 600-char limit. The split always happens between words — never mid-word.

---

### Merging tiny fragments

After splitting, any chunk smaller than 80 chars is merged into the previous one:

```typescript
const mergeSmallChunks = (chunks: string[]): string[] => {
  const result: string[] = [];
  for (const chunk of chunks) {
    if (chunk.length < MIN_CHUNK_SIZE && result.length > 0) {
      result[result.length - 1] += ' ' + chunk;  // append to previous
    } else {
      result.push(chunk);
    }
  }
  return result;
};
```

**Why**: A fragment like `"See table above."` alone has no useful meaning for search. Merging it with the surrounding context preserves meaning.

---

### Adding overlap

The final step adds 120 characters from the **end of the previous chunk** to the **beginning of the current chunk**:

```typescript
const addOverlap = (chunks: string[]): string[] => {
  return chunks.map((chunk, i) => {
    if (i === 0) return chunk;  // first chunk has no previous
    const prev = chunks[i - 1];
    const overlapRaw = prev.substring(Math.max(0, prev.length - CHUNK_OVERLAP));
    const overlap = overlapRaw.replace(/^\S+\s/, '');  // start at a word boundary
    return overlap ? `${overlap} ${chunk}` : chunk;
  });
};
```

**Why overlap?** Without it, a sentence that spans two chunks would be split in half. The embedding of chunk 2 would be missing the beginning of that sentence. Overlap ensures every chunk contains enough surrounding context for the model to understand it correctly.

**Example:**

```
Chunk 1 (600 chars):
"...The contract was signed by Jean Dupont on 15 March 2024. The terms include
a 12-month notice period and a non-compete clause for the software industry."

Chunk 2 (with overlap prepended):
"...a non-compete clause for the software industry.  ← 120 chars from chunk 1
The salary is set at €85,000 per year, reviewed annually based on performance."
```

Now if someone asks "what is the notice period?", the overlap in chunk 1 contains the answer. If they ask "what is the salary?", chunk 2 contains the context needed to answer it fully.

---

## Stage 3 — Embedding generation

**File**: `embedding.service.ts`, functions `generateEmbeddingsBatch()`, `getExtractor()`

### What is an embedding?

An embedding is a list of numbers (a vector) that represents the *meaning* of a piece of text.

- Two texts with similar meaning produce vectors that are close to each other in space.
- Two unrelated texts produce vectors that are far apart.
- The distance between vectors is measured with **cosine similarity**.

### The model: `Xenova/all-MiniLM-L6-v2`

```typescript
extractorPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
```

| Property | Value |
|---|---|
| Model type | Sentence transformer (MiniLM) |
| Vector dimensions | **384 numbers** per chunk |
| Max input | 8,000 characters |
| Pooling | **Mean pooling** (average of all token vectors) |
| Normalisation | **L2-normalised** (vector length = 1) |
| Runs | **100% locally** — no API key, no internet call |
| Library | `@xenova/transformers` (ONNX runtime in Node.js) |

Mean pooling means: the model generates one vector per word token, then takes the average of all of them. This produces a single 384-dimensional vector that represents the overall meaning of the whole chunk.

L2-normalisation means: the vector is scaled so its length equals exactly 1. This makes cosine similarity equivalent to a simple dot product — faster and numerically stable.

### Batched inference

Instead of embedding one chunk at a time (slow), the code processes 8 chunks in a single model call:

```typescript
const batches = chunkArray(chunks, EMBEDDING_BATCH_SIZE);  // EMBEDDING_BATCH_SIZE = 8

for (let batchNum = 0; batchNum < batches.length; batchNum++) {
  const batch = batches[batchNum];
  const embeddings = await generateEmbeddingsBatch(batch);
  // embeddings = [[384 numbers], [384 numbers], ..., [384 numbers]] (8 arrays)
  ...
}
```

**Why batching?** The model loads its weights once and processes 8 texts in parallel — much faster than 8 separate calls. The batch size of 8 is tuned for CPU memory — large enough to be efficient, small enough not to exhaust RAM.

### Text length limit

```typescript
const output = await extractor(
  texts.map((t) => t.substring(0, 8000)),  // hard cap at 8,000 chars
  { pooling: 'mean', normalize: true }
);
```

Chunks are at most 600 chars after chunking, so they are well within this limit. The cap is a safety net.

---

## Stage 4 — Saving to MongoDB

**File**: `embedding.service.ts`, function `indexDocument()`  
**Model**: `chunk.model.ts`, collection `documentchunks`

### First: delete stale data

If the document was previously indexed (e.g. after a re-index), old chunks are deleted first:

```typescript
await DocumentChunkModel.deleteMany({ documentId });
```

This prevents duplicate chunks from accumulating across multiple indexing runs.

### Then: insert all chunks

Each chunk becomes one MongoDB document in the `documentchunks` collection:

```typescript
const chunkDocs = batch.map((text, i) => ({
  documentId,                         // which document this chunk belongs to
  ownerId: doc.ownerId,               // which user owns it (for data isolation)
  chunkIndex: chunkIndex + i,         // position in the original document (0, 1, 2, ...)
  text,                               // the raw chunk text
  embedding: embeddings[i],           // [384 numbers]
  tokenCount: Math.ceil(text.length / 4),  // approximate token count
}));

await DocumentChunkModel.insertMany(chunkDocs);
```

### The MongoDB schema

```typescript
{
  documentId:  ObjectId,   // ref → Document
  ownerId:     ObjectId,   // ref → User
  chunkIndex:  Number,     // 0, 1, 2, ... (order in document)
  pageNumber:  Number?,    // page number if available from PDF
  text:        String,     // the raw text of this chunk
  embedding:   [Number],   // 384 floats
  tokenCount:  Number,     // estimated token count
  createdAt:   Date        // auto-set by Mongoose timestamps
}
```

### Database indexes

Two indexes are created for query performance:

```typescript
documentChunkSchema.index({ documentId: 1, chunkIndex: 1 });  // fetch all chunks of a doc in order
documentChunkSchema.index({ ownerId: 1 });                     // filter by owner (data isolation)
```

---

## How search uses the indexed data

After indexing, when a user asks a question, the search process is:

```
User question: "what are the payment terms?"
       │
       ▼
Embed the question with the same model
→ queryVector = [0.023, -0.41, 0.18, ...] (384 numbers)
       │
       ▼
Option A: Cosine similarity (default)
  - Load ALL chunks owned by the user from MongoDB
  - For each chunk: compute cosine_similarity(queryVector, chunk.embedding)
  - Sort by score descending
  - Return top-K results

Option B: MongoDB Atlas Vector Search (if VECTOR_SEARCH_ENABLED=true)
  - Use MongoDB's $vectorSearch aggregation stage
  - Atlas runs ANN (Approximate Nearest Neighbour) — much faster at scale
  - Falls back to Option A if Atlas search fails
```

### Cosine similarity formula

```
cosine_similarity(A, B) = (A · B) / (|A| × |B|)
```

Since vectors are L2-normalised (length = 1), this simplifies to just the dot product:

```
cosine_similarity(A, B) = A · B = Σ(A[i] × B[i])
```

Score = 1.0 means identical meaning.  
Score = 0.0 means completely unrelated.  
Score < 0 is theoretically possible but rare in practice.

The RAG service filters out chunks with score below `0.08` (very low relevance threshold, kept low to allow broad questions like "what is this document about?").

---

## Complete example — indexing a CV

Suppose the user uploads `CV_Ala.pdf`, which contains 2,400 characters of extracted text.

**After normalisation:**
```
"Ala Missaoui\nDéveloppeur Full-Stack\n\nEXPÉRIENCE PROFESSIONNELLE\n\nStagiaire..."
```

**After chunking (approximate result):**

| Chunk # | Content (abbreviated) | Length |
|---|---|---|
| 0 | `Ala Missaoui\nDéveloppeur Full-Stack\n\nEXPÉRIENCE PROFESSIONNELLE\n\nStagiaire développeur...` | 598 chars |
| 1 | `...développeur chez Acme Corp (overlap) Compétences techniques: Python, JavaScript, TypeScript...` | 612 chars |
| 2 | `...TypeScript, React, Node.js (overlap) FORMATION\n\nLicence Informatique, Université de Tunis...` | 580 chars |
| 3 | `...Université de Tunis (overlap) PROJETS\n\nPlateforme e-commerce React + Node.js...` | 543 chars |

**After embedding (each chunk → 384 numbers):**
```
chunk 0: [0.021, -0.314, 0.087, 0.195, ..., -0.042]  ← 384 floats
chunk 1: [0.198, -0.041, 0.312, 0.074, ...,  0.163]
chunk 2: [-0.112, 0.287, 0.041, 0.308, ..., -0.091]
chunk 3: [0.074, 0.162, -0.208, 0.419, ...,  0.033]
```

**Stored in MongoDB as 4 documents in `documentchunks`.**

**Later, when someone asks "what programming languages does Ala know?":**
```
queryVector = embed("what programming languages does Ala know?")
             = [0.187, -0.029, 0.301, 0.068, ...,  0.152]

cosine_similarity(queryVector, chunk_0) = 0.31  ← mentions developer
cosine_similarity(queryVector, chunk_1) = 0.82  ← mentions Python, JavaScript, TypeScript ✓
cosine_similarity(queryVector, chunk_2) = 0.74  ← mentions React, Node.js ✓
cosine_similarity(queryVector, chunk_3) = 0.28  ← projects, less relevant

Top-2 results: chunk_1 (0.82) and chunk_2 (0.74) → sent as context to the LLM
```

---

## Summary

| Step | What happens | Key detail |
|---|---|---|
| Normalise | Clean whitespace | Windows newlines, tabs, 3+ blank lines |
| Paragraph split | Split on `\n\n` | Preferred boundary |
| Heading detection | Force new chunk at headings | Regex: `#`, `1.`, `ALL-CAPS:` |
| Sentence split | Split large paragraphs on `.!?` | Lookbehind regex, never mid-sentence |
| Word split | Last resort for huge sentences | Never mid-word |
| Merge tiny | Chunks < 80 chars → appended to previous | Drops noise fragments |
| Add overlap | 120 chars from previous chunk prepended | Word-boundary aligned |
| Embed | all-MiniLM-L6-v2 → 384-dim vector | Mean-pooled, L2-normalised, local |
| Batch | 8 chunks per model call | CPU memory optimisation |
| Store | MongoDB `documentchunks` collection | documentId, ownerId, chunkIndex, text, embedding |
