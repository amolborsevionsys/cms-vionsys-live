import { env } from './env';
import { AppError } from './errors';
import { logger } from './logger';

/*
 * Minimal Google Gemini REST client (no SDK).
 *
 * Providers:
 *   - AI Studio / Gemini Developer API (default) → generativelanguage.googleapis.com.
 *     Works with both key formats: new "Auth keys" (start with "AQ.", issued since mid-2026)
 *     and legacy "Standard keys" (start with "AIza"). Free tier available.
 *   - Vertex AI (opt-in with GEMINI_PROVIDER=vertex) → aiplatform.googleapis.com, billed via
 *     Google Cloud; the "Agent Platform" (Vertex AI) API must be enabled in the key's project.
 *   - generateJson: structured output constrained by a JSON Schema
 *   - generateText: free-form answer
 *   - embedTexts / embedQuery: gemini-embedding-001 vectors for retrieval
 *
 * Server-only. The API key is read from GEMINI_API_KEY and sent as a header,
 * never in the URL, so it does not end up in logs.
 */

const AI_STUDIO_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const VERTEX_BASE = 'https://aiplatform.googleapis.com/v1/publishers/google';

/** Vertex AI only when explicitly configured. AQ./AIza keys from AI Studio both use the Gemini Developer API. */
function isVertex(): boolean {
  return process.env.GEMINI_PROVIDER?.trim().toLowerCase() === 'vertex';
}
const GENERATE_TIMEOUT_MS = 90_000;
const EMBED_TIMEOUT_MS = 30_000;
export const EMBEDDING_DIMENSIONS = 768;
const EMBED_BATCH_SIZE = 100; // API maximum per batchEmbedContents call

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

function requireKey(): string {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      'AI features are not configured. Add GEMINI_API_KEY to the environment and restart the server.',
      'AI_NOT_CONFIGURED',
      503
    );
  }
  return env.GEMINI_API_KEY;
}

/** Temporary server-side failures (incl. "model is experiencing high demand") are retried. */
const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1500, 4000];
/** Stop retrying once this much time has passed, to stay inside the route's 60 s limit. */
const RETRY_BUDGET_MS = 25_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const key = requireKey();
  const started = Date.now();
  let res: Response;

  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`${isVertex() ? VERTEX_BASE : AI_STUDIO_BASE}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      throw new AppError(
        timedOut ? 'The AI service took too long to respond. Try again, or use a shorter document.' : 'Could not reach the AI service.',
        'AI_UNAVAILABLE',
        504
      );
    }

    const canRetry =
      RETRYABLE_STATUS.has(res.status) &&
      attempt < RETRY_DELAYS_MS.length &&
      Date.now() - started + RETRY_DELAYS_MS[attempt] < RETRY_BUDGET_MS;
    if (!canRetry) break;
    logger.warn(`Gemini ${path} returned ${res.status}; retrying (attempt ${attempt + 2})`);
    await res.body?.cancel().catch(() => undefined);
    await sleep(RETRY_DELAYS_MS[attempt]);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    logger.error(`Gemini ${path} failed with ${res.status}`, detail.slice(0, 500));
    if (RETRYABLE_STATUS.has(res.status)) {
      throw new AppError(
        'Gemini is busy right now (high demand on the model). Wait a minute and try again.',
        'AI_BUSY',
        503
      );
    }
    if (res.status === 429) {
      throw new AppError('The AI usage limit was reached (free tier). Wait a minute and try again.', 'AI_RATE_LIMITED', 429);
    }
    if (res.status === 403 && /has not been used|is disabled|SERVICE_DISABLED/i.test(detail)) {
      throw new AppError(
        'The Google Cloud project for this API key has the required API turned off. For an AI Studio key, remove GEMINI_PROVIDER from .env; for Vertex AI, enable the "Agent Platform" API in Google Cloud.',
        'AI_NOT_CONFIGURED',
        503
      );
    }
    if ((res.status === 400 || res.status === 401 || res.status === 403) && /API key|UNAUTHENTICATED|PERMISSION_DENIED/i.test(detail)) {
      throw new AppError('The Gemini API key was rejected. Check GEMINI_API_KEY.', 'AI_NOT_CONFIGURED', 503);
    }
    if (res.status === 404) {
      throw new AppError(`The AI model was not found. Check GEMINI_MODEL / GEMINI_EMBEDDING_MODEL.`, 'AI_NOT_CONFIGURED', 503);
    }
    throw new AppError('The AI service returned an error. Try again.', 'AI_ERROR', 502);
  }

  return (await res.json()) as T;
}

interface GenerateResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

function readText(data: GenerateResponse): string {
  if (data.promptFeedback?.blockReason) {
    throw new AppError('The AI declined to process this content.', 'AI_BLOCKED', 422);
  }
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new AppError('The document is too long for one pass. Split it into smaller files.', 'AI_OUTPUT_TOO_LONG', 422);
  }
  if (!text) {
    throw new AppError('The AI returned an empty response. Try again.', 'AI_EMPTY', 502);
  }
  return text;
}

/** Structured output: the model's reply is constrained to `schema` and parsed. */
export async function generateJson<T>(options: {
  system: string;
  parts: GeminiPart[];
  schema: Record<string, unknown>;
  temperature?: number;
}): Promise<T> {
  const data = await callGemini<GenerateResponse>(
    `models/${env.GEMINI_MODEL}:generateContent`,
    {
      systemInstruction: { parts: [{ text: options.system }] },
      contents: [{ role: 'user', parts: options.parts }],
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        responseMimeType: 'application/json',
        responseJsonSchema: options.schema,
      },
    },
    GENERATE_TIMEOUT_MS
  );
  const text = readText(data);
  try {
    return JSON.parse(text) as T;
  } catch {
    logger.error('Gemini returned invalid JSON', text.slice(0, 500));
    throw new AppError('The AI returned an unreadable response. Try again.', 'AI_BAD_OUTPUT', 502);
  }
}

/** Free-form text answer. */
export async function generateText(options: { system: string; prompt: string; temperature?: number }): Promise<string> {
  const data = await callGemini<GenerateResponse>(
    `models/${env.GEMINI_MODEL}:generateContent`,
    {
      systemInstruction: { parts: [{ text: options.system }] },
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      generationConfig: { temperature: options.temperature ?? 0.3 },
    },
    GENERATE_TIMEOUT_MS
  );
  return readText(data);
}

type TaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

/** Vertex: one text per :predict call (gemini-embedding-001 accepts a single instance), a few in parallel. */
async function embedTextsVertex(texts: string[], taskType: TaskType): Promise<number[][]> {
  const path = `models/${env.GEMINI_EMBEDDING_MODEL}:predict`;
  const vectors: number[][] = new Array(texts.length);
  const CONCURRENCY = 5;
  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    await Promise.all(
      texts.slice(i, i + CONCURRENCY).map(async (text, j) => {
        const data = await callGemini<{ predictions?: { embeddings?: { values: number[] } }[] }>(
          path,
          { instances: [{ content: text, task_type: taskType }], parameters: { outputDimensionality: EMBEDDING_DIMENSIONS } },
          EMBED_TIMEOUT_MS
        );
        const values = data.predictions?.[0]?.embeddings?.values;
        if (!values) throw new AppError('The AI returned incomplete embeddings. Try again.', 'AI_BAD_OUTPUT', 502);
        vectors[i + j] = values;
      })
    );
  }
  return vectors;
}

/** Embeds many texts (batched). Returns one vector per input, in order. */
export async function embedTexts(texts: string[], taskType: TaskType = 'RETRIEVAL_DOCUMENT'): Promise<number[][]> {
  if (isVertex()) return embedTextsVertex(texts, taskType);
  const model = `models/${env.GEMINI_EMBEDDING_MODEL}`;
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const data = await callGemini<{ embeddings?: { values: number[] }[] }>(
      `${model}:batchEmbedContents`,
      {
        requests: batch.map((text) => ({
          model,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: EMBEDDING_DIMENSIONS,
        })),
      },
      EMBED_TIMEOUT_MS
    );
    if (!data.embeddings || data.embeddings.length !== batch.length) {
      throw new AppError('The AI returned incomplete embeddings. Try again.', 'AI_BAD_OUTPUT', 502);
    }
    vectors.push(...data.embeddings.map((e) => e.values));
  }
  return vectors;
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embedTexts([text], 'RETRIEVAL_QUERY');
  return vector;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
