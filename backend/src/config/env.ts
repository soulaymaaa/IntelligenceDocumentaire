import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().default('"Intelligence Documentaire" <noreply@intelligence-documentaire.com>'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.string().default('50').transform(Number),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX: z.string().default('100').transform(Number),
  AUTH_RATE_LIMIT_MAX: z.string().default('10').transform(Number),
  AI_RATE_LIMIT_MAX: z.string().default('20').transform(Number),
  OCR_LANGUAGES: z.string().default('fra+eng'),
  REDIS_URL: z.string().optional(),
  USE_SIMPLE_QUEUE: z.string().default('true').transform((v) => v === 'true'),
  AUTO_VERIFY: z.string().default('false').transform((v) => v === 'true'),

  // ── AI Providers (at least one must be configured) ───────────────────────
  // Option 1: Groq — genuinely free, no credits (get key at https://console.groq.com)
  GROQ_API_KEY: z.string().optional(),
  // Option 2: OpenRouter — free models, may need credits
  OPENROUTER_API_KEY: z.string().optional(),
  // Option 3: Ollama — local, completely free (default: http://localhost:11434)
  OLLAMA_URL: z.string().default('http://localhost:11434'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
