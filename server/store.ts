// Loads the catalog and vectors produced by ingestion/build-index.ts and keeps
// them in memory for the life of the process (one cold start per function).

import fs from 'fs';
import path from 'path';
import type { Catalog, Property, Segment } from '../types.js';

export interface IndexedSegment {
  segment: Segment;
  property: Property;
  visual?: Float32Array;
  speech?: Float32Array;
  terms: Map<string, number>;
  length: number;
}

export interface Store {
  catalog: Catalog;
  segments: IndexedSegment[];
  byProperty: Map<string, Property>;
  hasVectors: boolean;
  /** Image embedding of each room chapter's still, keyed by its frame path. */
  stills: Map<string, Float32Array>;
  docFreq: Map<string, number>;
  avgLength: number;
}

interface StillFile {
  model: string;
  dims: number;
  stills: Record<string, string>;
}

interface VectorFile {
  model: string;
  dims: number;
  segments: Record<string, { v?: string; t?: string }>;
}

const STOPWORDS = new Set(
  'a an and are as at be but by for from has have in into is it its of on or that the this to was were with you your we our there here so very just'.split(' '),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
    .map(t => (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

function decode(b64: string): Float32Array {
  const buf = Buffer.from(b64, 'base64');
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function dataDir() {
  return process.env.PROPERTYLENS_DATA_DIR || path.join(process.cwd(), 'data');
}

let cached: Store | null = null;

export function loadStore(): Store {
  if (cached) return cached;
  const dir = dataDir();
  const catalog: Catalog = JSON.parse(fs.readFileSync(path.join(dir, 'properties.json'), 'utf-8'));

  const vectorPath = path.join(dir, 'vectors.json');
  const vectors: VectorFile | null = fs.existsSync(vectorPath)
    ? JSON.parse(fs.readFileSync(vectorPath, 'utf-8'))
    : null;

  // Written by ingestion/embed-stills.ts; search works without it.
  const stillPath = path.join(dir, 'stills.json');
  const stillFile: StillFile | null = fs.existsSync(stillPath) ? JSON.parse(fs.readFileSync(stillPath, 'utf-8')) : null;
  const stills = new Map(Object.entries(stillFile?.stills ?? {}).map(([frame, b64]) => [frame, decode(b64)]));

  const segments: IndexedSegment[] = [];
  const docFreq = new Map<string, number>();
  const byProperty = new Map<string, Property>();
  let totalLength = 0;

  for (const property of catalog.properties) {
    byProperty.set(property.id, property);
    for (const segment of property.segments) {
      const tokens = tokenize(
        [segment.room, segment.caption, segment.features.join(' '), segment.transcript].join(' '),
      );
      const terms = new Map<string, number>();
      for (const t of tokens) terms.set(t, (terms.get(t) ?? 0) + 1);
      for (const t of terms.keys()) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
      totalLength += tokens.length;

      const vec = vectors?.segments[segment.id];
      segments.push({
        segment,
        property,
        visual: vec?.v ? decode(vec.v) : undefined,
        speech: vec?.t ? decode(vec.t) : undefined,
        terms,
        length: tokens.length,
      });
    }
  }

  cached = {
    catalog,
    segments,
    byProperty,
    hasVectors: segments.some(s => s.visual || s.speech),
    stills,
    docFreq,
    avgLength: segments.length ? totalLength / segments.length : 1,
  };
  return cached;
}

export function bm25(store: Store, queryTerms: string[], doc: IndexedSegment): number {
  const k1 = 1.2;
  const b = 0.75;
  const N = store.segments.length;
  let score = 0;
  for (const term of new Set(queryTerms)) {
    const tf = doc.terms.get(term);
    if (!tf) continue;
    const df = store.docFreq.get(term) ?? 0;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.length) / store.avgLength)));
  }
  return score;
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function withoutSegments(p: Property): Omit<Property, 'segments'> {
  const { segments: _ignored, ...rest } = p;
  return rest;
}
