import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// ── Provider Configuration ──────────────────────────────────────────────────

/**
 * Provider priority order (try each in sequence):
 * 1. GROQ — genuinely free, no credits required (https://console.groq.com)
 * 2. OPENROUTER — free models, may require credits on some accounts
 * 3. OLLAMA — local, completely free (requires Ollama installed)
 */

// Groq free models (no credits needed)
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma-2-9b-it',
  'qwen-2.5-32b',
];

// OpenRouter free models (tested — these work WITHOUT credits on the account)
const OPENROUTER_FREE_MODELS = [
  'google/gemma-3-12b-it:free',       // ✅ Confirmed working, no credits needed
  'google/gemma-3-4b-it:free',        // ✅ Confirmed working, faster
  'google/gemma-3n-e4b-it:free',      // ✅ Confirmed working
  'openai/gpt-oss-20b:free',          // ✅ Should work
  'qwen/qwen3-coder:free',            // ✅ Should work
  'z-ai/glm-4.5-air:free',            // ✅ Should work
  'nvidia/nemotron-nano-9b-v2:free',  // ✅ Should work
];

// ── Shared Clients ──────────────────────────────────────────────────────────

let groqClient: OpenAI | null = null;
let openrouterClient: OpenAI | null = null;
let ollamaClient: OpenAI | null = null;

const getGroqClient = (): OpenAI | null => {
  if (!groqClient && env.GROQ_API_KEY) {
    groqClient = new OpenAI({
      apiKey: env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return groqClient;
};

const getOpenRouterClient = (): OpenAI | null => {
  if (!openrouterClient && env.OPENROUTER_API_KEY) {
    openrouterClient = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });
  }
  return openrouterClient;
};

const getOllamaClient = (): OpenAI | null => {
  if (!ollamaClient) {
    const ollamaUrl = env.OLLAMA_URL || 'http://localhost:11434';
    ollamaClient = new OpenAI({
      apiKey: 'ollama', // Ollama doesn't require a real key
      baseURL: `${ollamaUrl}/v1`,
    });
  }
  return ollamaClient;
};

// ── LLM Error Types ────────────────────────────────────────────────────────

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly type: 'rate_limit' | 'no_credits' | 'unavailable' | 'config' = 'unavailable'
  ) {
    super(message);
  }
}

// ── Core Chat Function ─────────────────────────────────────────────────────

interface ChatParams {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Main entry point: tries providers in priority order (Groq → OpenRouter → Ollama).
 * Returns the first successful response.
 */
export const chatCompletion = async (params: ChatParams): Promise<string> => {
  // 1. Try Groq (free, no credits needed)
  const groq = getGroqClient();
  if (groq) {
    for (const model of GROQ_MODELS) {
      try {
        const result = await attemptWithRetries(groq, model, params, 2, 2000);
        logger.info(`LLM: used Groq model ${model}`);
        return result;
      } catch (err: any) {
        if (err.status === 400) continue; // model not available, try next
        if (err.status === 429) {
          logger.warn(`Groq model ${model} rate-limited, trying next`);
          continue;
        }
        logger.warn(`Groq model ${model} failed: ${err.message}`);
      }
    }
  }

  // 2. Try OpenRouter free models
  const openrouter = getOpenRouterClient();
  if (openrouter) {
    for (const model of OPENROUTER_FREE_MODELS) {
      try {
        const result = await attemptWithRetries(openrouter, model, params, 2, 3000);
        logger.info(`LLM: used OpenRouter model ${model}`);
        return result;
      } catch (err: any) {
        if (err.status === 402) {
          logger.warn(`OpenRouter model ${model} requires credits, trying next`);
          continue;
        }
        if (err.status === 429) {
          logger.warn(`OpenRouter model ${model} rate-limited, trying next`);
          continue;
        }
        if (err.status === 400) continue;
        logger.warn(`OpenRouter model ${model} failed: ${err.message}`);
      }
    }
  }

  // 3. Try Ollama (local)
  const ollama = getOllamaClient();
  if (ollama) {
    const localModels = ['llama3.1', 'llama3', 'mistral', 'gemma2:9b', 'qwen2.5'];
    for (const model of localModels) {
      try {
        const result = await attemptWithRetries(ollama, model, params, 1, 1000);
        logger.info(`LLM: used local Ollama model ${model}`);
        return result;
      } catch (err: any) {
        logger.warn(`Ollama model ${model} failed: ${err.message}`);
      }
    }
  }

  // All providers exhausted
  throw new LLMError(
    'No AI provider is available. Please configure at least one of: ' +
    'GROQ_API_KEY (free at groq.com), OPENROUTER_API_KEY, or Ollama (localhost:11434).',
    'config'
  );
};

// ── Retry Helper ───────────────────────────────────────────────────────────

const attemptWithRetries = async (
  client: OpenAI,
  model: string,
  params: ChatParams,
  maxRetries: number,
  baseDelayMs: number
): Promise<string> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: params.messages as any,
        temperature: params.temperature ?? 0.1,
        max_tokens: params.max_tokens ?? 1000,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) throw new Error('Empty response from model');
      return content;
    } catch (err: any) {
      lastError = err;

      // Don't retry client errors (4xx) except 429
      if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }

      if (attempt >= maxRetries) break;

      const delay = baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError || new Error('LLM request failed');
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ── Backwards Compatibility Alias ──────────────────────────────────────────

/** @deprecated Use chatCompletion instead */
export const chatCompletionWithRetry = chatCompletion;
