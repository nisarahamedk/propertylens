// Web-standard Request -> Response handlers shared by the Vercel functions in
// api/ and the Vite dev middleware.

import type { ChatRequest } from '../types';
import { chat } from './chat';
import { GeminiError } from './gemini';
import { search } from './search';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Per-instance limiter. Good enough to stop casual abuse of a public demo; pair
// it with a spend cap on the Gemini key.
const hits = new Map<string, number[]>();
function rateLimited(req: Request, perMinute: number): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(t => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > perMinute;
}

export async function handleSearch(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (rateLimited(req, 30)) return json({ error: 'Too many searches. Try again in a minute.' }, 429);
  const body = await req.json().catch(() => ({}));
  const q = String(body.q ?? '').trim().slice(0, 300);
  if (!q) return json({ error: 'Missing query' }, 400);
  try {
    return json(await search(q));
  } catch (e) {
    const status = e instanceof GeminiError && e.status === 429 ? 429 : 500;
    return json({ error: status === 429 ? 'Search is busy. Try again shortly.' : 'Search failed.' }, status);
  }
}

export async function handleChat(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (rateLimited(req, 15)) return json({ error: 'Too many questions. Try again in a minute.' }, 429);
  const body = (await req.json().catch(() => ({}))) as ChatRequest;
  if (!body.youtubeId || !body.question?.trim()) return json({ error: 'Missing youtubeId or question' }, 400);
  body.question = body.question.slice(0, 500);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of chat(body)) controller.enqueue(encoder.encode(delta));
      } catch {
        controller.enqueue(encoder.encode('\n\nSorry, the answer was cut off. Please try again.'));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}
