// Minimal Gemini REST client. Plain fetch keeps the serverless bundle small and
// works the same in Node scripts, the Vite dev server and Vercel functions.

import { EMBEDDING_DIMS, MODELS } from './config.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiError extends Error {
  constructor(message: string, public status: number, public retryAfterMs?: number) {
    super(message);
  }
}

export function getApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || undefined;
}

export type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

// Request handlers keep retries short so a search never outlives the function
// timeout. The indexer raises both limits (see ingestion/build-index.ts).
const maxAttempts = () => Number(process.env.GEMINI_MAX_ATTEMPTS ?? 3);
const maxWaitMs = () => Number(process.env.GEMINI_MAX_WAIT_MS ?? 4000);

/** How long Gemini asks us to wait, from the RetryInfo detail of a 429 body (e.g. "retryDelay": "31s"). */
export function retryDelayMs(body: string): number | undefined {
  const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : undefined;
}

/** POSTs to the API and returns the ok response, retrying rate limits and transient server errors. */
async function post(path: string, body: unknown, apiKey: string, attempt = 0): Promise<Response> {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (res.ok) return res;
  const text = await res.text();
  // Back off on rate limits and transient server errors. Free-tier limits are
  // per minute, so honour the delay Gemini asks for rather than guessing.
  const asked = res.status === 429 ? retryDelayMs(text) : undefined;
  const wait = asked ?? 1000 * 2 ** attempt;
  if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts() - 1 && wait <= maxWaitMs()) {
    await new Promise(r => setTimeout(r, wait + Math.random() * 500));
    return post(path, body, apiKey, attempt + 1);
  }
  throw new GeminiError(`Gemini ${path} failed: ${res.status} ${text.slice(0, 300)}`, res.status, asked);
}

// ---- Flash model fallback ----

// Models that recently refused a request, and when to try them again. Per
// instance, so each serverless instance learns after at most one failed call.
const cooling = new Map<string, number>();

/** How long to skip a model after this error, or 0 if trying another model would not help. */
function cooldownFor(e: GeminiError): number {
  if (e.status === 429) return e.retryAfterMs ?? 60_000; // per-minute or per-day quota
  if (e.status === 404 || e.status === 403) return 6 * 3600_000; // model not available to this key
  if (e.status >= 500) return 30_000; // overloaded
  return 0;
}

/** Runs a Flash request on the first model in the chain that is not cooling down. */
async function withFlashFallback<T>(run: (model: string) => Promise<T>): Promise<T> {
  const now = Date.now();
  const chain = MODELS.flashChain;
  const ready = chain.filter(m => (cooling.get(m) ?? 0) <= now);
  // If every model is cooling, try the one that recovers first rather than fail outright.
  const order = ready.length ? ready : [...chain].sort((a, b) => (cooling.get(a) ?? 0) - (cooling.get(b) ?? 0));
  let last: unknown;
  for (const model of order) {
    try {
      return await run(model);
    } catch (e) {
      const wait = e instanceof GeminiError ? cooldownFor(e) : 0;
      if (!wait) throw e;
      cooling.set(model, Date.now() + wait);
      console.warn(`[gemini] ${model} unavailable (${(e as GeminiError).status}); skipping it for ${Math.round(wait / 1000)}s`);
      last = e;
    }
  }
  throw last;
}

const call = async (path: string, body: unknown, apiKey: string): Promise<any> => (await post(path, body, apiKey)).json();

export function normalize(v: number[] | Float32Array): Float32Array {
  const out = Float32Array.from(v);
  let norm = 0;
  for (let i = 0; i < out.length; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

export async function embed(parts: Part[], apiKey: string): Promise<Float32Array> {
  const data = await call(`models/${MODELS.embedding}:embedContent`, {
    content: { parts },
    outputDimensionality: EMBEDDING_DIMS,
  }, apiKey);
  const values: number[] | undefined = data?.embedding?.values;
  if (!values?.length) throw new GeminiError('Empty embedding in response', 502);
  return normalize(values);
}

// gemini-embedding-2 takes task instructions as text prefixes instead of a taskType field.
export const queryText = (q: string) => `task: search result | query: ${q}`;
export const documentText = (title: string, text: string) => `title: ${title || 'none'} | text: ${text}`;

interface GenerateOptions {
  system?: string;
  schema?: object;      // JSON schema for structured output
  temperature?: number;
}

function generateBody(contents: { role: string; parts: Part[] }[], opts: GenerateOptions) {
  return {
    contents,
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      ...(opts.schema ? { responseMimeType: 'application/json', responseSchema: opts.schema } : {}),
    },
  };
}

export async function generate(
  contents: { role: string; parts: Part[] }[],
  apiKey: string,
  opts: GenerateOptions = {},
): Promise<string> {
  const data = await withFlashFallback(model => call(`models/${model}:generateContent`, generateBody(contents, opts), apiKey));
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: any) => p.text ?? '').join('');
}

export async function generateJson<T>(
  contents: { role: string; parts: Part[] }[],
  apiKey: string,
  opts: GenerateOptions & { schema: object },
): Promise<T> {
  const text = await generate(contents, apiKey, opts);
  return JSON.parse(text) as T;
}

/** Streams text deltas from the model as they arrive. */
export async function* generateStream(
  contents: { role: string; parts: Part[] }[],
  apiKey: string,
  opts: GenerateOptions = {},
): AsyncGenerator<string> {
  // Retrying is safe here: nothing has been streamed to the caller yet.
  const res = await withFlashFallback(model => post(`models/${model}:streamGenerateContent?alt=sse`, generateBody(contents, opts), apiKey));
  if (!res.body) throw new GeminiError('Gemini stream returned no body', 502);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      try {
        const chunk = JSON.parse(line.slice(5));
        const text = (chunk?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
        if (text) yield text;
      } catch {
        // Ignore keep-alive or partial lines.
      }
    }
  }
}
