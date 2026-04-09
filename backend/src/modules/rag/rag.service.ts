import Groq from 'groq-sdk';
import { generateEmbedding, semanticSearch } from '../embeddings/embedding.service';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const QA_MODEL = 'llama-3.3-70b-versatile';

let groqClient: Groq | null = null;

const getGroq = (): Groq => {
  if (!groqClient) {
    if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');
    groqClient = new Groq({ apiKey: env.GROQ_API_KEY });
  }
  return groqClient;
};

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

export const askQuestion = async (
  question: string,
  ownerId: string,
  documentId?: string,
  topK = 5
): Promise<RagAnswer> => {
  logger.info(`RAG Q&A: "${question}" (documentId: ${documentId || 'all'})`);

  // Retrieve relevant chunks
  const queryEmbedding = await generateEmbedding(question);
  const results = await semanticSearch(queryEmbedding, ownerId, topK, documentId);

  if (results.length === 0) {
    return {
      answer: "I don't have enough information in your documents to answer this question.",
      sources: [],
      hasAnswer: false,
    };
  }

  const sources: RagSource[] = results.map(({ chunk, score }) => ({
    chunkId: chunk._id.toString(),
    documentId: chunk.documentId?._id?.toString() || chunk.documentId?.toString(),
    documentName: (chunk.documentId as any)?.originalName || 'Unknown document',
    text: chunk.text,
    chunkIndex: chunk.chunkIndex,
    pageNumber: chunk.pageNumber,
    score: Math.round(score * 1000) / 1000,
  }));

  // Build context from top chunks
  const context = sources
    .map((s, i) => `[Source ${i + 1} - ${s.documentName}]:\n${s.text}`)
    .join('\n\n---\n\n');

  const groq = getGroq();

  const systemPrompt = `You are a helpful document assistant. Answer the user's question ONLY based on the provided document context below.

Rules:
- Use ONLY information from the provided context.
- If the answer is not in the context, say clearly: "Based on the available documents, I cannot find an answer to this question."
- Be concise and accurate.
- Reference sources when relevant (e.g., "According to [Source 1]...").
- Respond in the same language as the question.

Document Context:
${context}`;

  const response = await groq.chat.completions.create({
    model: QA_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ],
    temperature: 0.1,
    max_tokens: 1000,
  });

  const answer = response.choices[0]?.message?.content?.trim() || '';
  const hasAnswer = !answer.toLowerCase().includes('cannot find an answer');

  return { answer, sources, hasAnswer };
};
