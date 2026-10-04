import catalogData from '../data/properties.json';
import type { Catalog, ChatRequest, Property, SearchResponse } from '../types';

export const catalog = catalogData as unknown as Catalog;

export const properties: Property[] = catalog.properties;

export const getProperty = (id: string) => properties.find(p => p.id === id);

export const totalScenes = properties.reduce((n, p) => n + p.segments.length, 0);

const searchCache = new Map<string, SearchResponse>();

export async function searchTours(q: string, signal?: AbortSignal): Promise<SearchResponse> {
  const key = q.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit) return hit;
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ q }),
    signal,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Search failed (${res.status})`);
  searchCache.set(key, body);
  return body;
}

/** Streams the assistant's answer, calling onDelta with each new piece of text. */
export async function askAboutTour(req: ChatRequest, onDelta: (text: string) => void, signal?: AbortSignal) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Chat failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onDelta(decoder.decode(value, { stream: true }));
  }
}
