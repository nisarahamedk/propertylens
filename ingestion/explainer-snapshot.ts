/**
 * Builds data/explainer.json for the How it works page: real query traces, score
 * calibration and a sample tour, captured once so the page makes no API calls.
 *
 * Usage: GEMINI_API_KEY=... npx tsx ingestion/explainer-snapshot.ts
 * Re-run after re-indexing or changing ranking settings.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EMBEDDING_DIMS, MODELS, RANKING, SEGMENT } from '../server/config';
import { embed, getApiKey, queryText } from '../server/gemini';
import { matchesFilters, search } from '../server/search';
import { bm25, dot, loadStore, tokenize } from '../server/store';

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, '..', 'data', 'explainer.json');
const key = getApiKey();
if (!key) throw new Error('Set GEMINI_API_KEY');
const store = loadStore();
const N = store.segments.length;
const round = (x: number) => Math.round(x * 1000) / 1000;

// The queries the page lets readers step through: the landing-page suggestions.
const TRACE_QUERIES = [
  '3 bed in Surrey with a fenced backyard',
  'Soaker tub in the ensuite',
  'Under $1M condo with city views',
  'Close to SkyTrain',
];
// For the calibration chart: things no tour has, and common features.
const ABSENT = ['zzqx blorf', 'horse stable and riding arena', 'snowy ski chalet with a sauna', 'chicken coop in the garden', 'spaceship cockpit', 'underwater aquarium tunnel', 'indoor basketball court', 'helicopter pad', 'vineyard with grape vines', 'lighthouse', 'bowling alley', 'treehouse'];
const PRESENT = ['kitchen island with bar seating', 'fireplace', 'walk-in closet', 'soaker tub', 'fenced backyard', 'double vanity', 'stainless steel appliances', 'hardwood floors', 'mountain views', 'two car garage', 'swimming pool', 'gym'];
const SAMPLE_TOUR = 'Gueg_zB5kAk';
const SAMPLE_SCENE = `${SAMPLE_TOUR}:0100`;

async function trace(q: string) {
  const res = await search(q); // the real path: parse, embed, score, fuse, group
  const parsed = res.interpreted;
  const qVec = await embed([{ text: queryText(parsed.semantic) }], key!);
  const candidates = store.segments.filter(s => matchesFilters(s.property, parsed.filters));
  const terms = tokenize(parsed.semantic);
  const raw = candidates.map(d => bm25(store, terms, d));
  const maxRaw = Math.max(0, ...raw);
  const distinctive = [...new Set(terms)].filter(t => (store.docFreq.get(t) ?? 0) / N < RANKING.distinctiveDocShare);
  const rows = candidates.map((d, i) => ({
    id: d.segment.id,
    tour: d.property.id,
    name: d.property.name,
    start: d.segment.start,
    room: d.segment.room,
    rooms: d.segment.rooms,
    frame: d.segment.frame,
    caption: d.segment.caption.slice(0, 140),
    visual: round(dot(qVec, d.visual!)),
    speech: round(dot(qVec, d.speech!)),
    keyword: round(maxRaw > 0 ? raw[i] / maxRaw : 0),
    allWords: distinctive.length > 0 && distinctive.every(t => d.terms.has(t)),
  }));
  // Ranks over every candidate, as the server computes them. Rank fusion depends on
  // ranks, not weights, so the page can re-weight these exactly.
  const rankOf = (k: 'visual' | 'speech' | 'keyword') => {
    const sorted = [...rows].sort((a, b) => b[k] - a[k]);
    return new Map(sorted.map((r, i) => [r.id, r[k] > 0 ? i + 1 : null]));
  };
  const rv = rankOf('visual'), rs = rankOf('speech'), rk = rankOf('keyword');
  // Shortlist: the top 20 by each signal, so re-ranking in the browser sees every
  // scene that could plausibly reach the top.
  const ids = new Set<string>();
  for (const k of ['visual', 'speech', 'keyword'] as const) {
    [...rows].sort((a, b) => b[k] - a[k]).slice(0, 20).forEach(r => ids.add(r.id));
  }
  return {
    query: q,
    semantic: parsed.semantic,
    filters: parsed.filters,
    candidates: candidates.length,
    candidateTours: new Set(candidates.map(c => c.property.id)).size,
    timings: res.stats.timings,
    results: res.matches.slice(0, 5).map(m => ({ tour: m.property.id, name: m.property.name, label: m.moments[0]?.label ?? m.moments[0]?.room, start: m.moments[0]?.start, frame: m.moments[0]?.frame })),
    shortlist: rows.filter(r => ids.has(r.id)).map(r => ({ ...r, ranks: [rv.get(r.id), rs.get(r.id), rk.get(r.id)] })),
  };
}

async function topBlended(q: string) {
  const v = await embed([{ text: queryText(q) }], key!);
  let best = 0;
  for (const s of store.segments) best = Math.max(best, RANKING.visualWeight * dot(v, s.visual!) + RANKING.speechWeight * dot(v, s.speech!));
  return { query: q, top: round(best) };
}

const traces = [];
for (const q of TRACE_QUERIES) traces.push(await trace(q));
const calibration = { absent: [] as { query: string; top: number }[], present: [] as { query: string; top: number }[] };
for (const q of ABSENT) calibration.absent.push(await topBlended(q));
for (const q of PRESENT) calibration.present.push(await topBlended(q));

const tour = store.catalog.properties.find(p => p.id === SAMPLE_TOUR)!;
const scene = store.segments.find(s => s.segment.id === SAMPLE_SCENE)!;
const sampleQuery = 'soaker tub in the ensuite';
const qv = await embed([{ text: queryText(sampleQuery) }], key!);
const head = (v: Float32Array, n = 96) => Array.from(v.slice(0, n), round);
const otherScene = store.segments.find(s => s.segment.id === `${SAMPLE_TOUR}:0000`)!;

const vectorsBytes = fs.statSync(path.join(dir, '..', 'data', 'vectors.json')).size;
const out = {
  generatedAt: new Date().toISOString(),
  // The model that wrote the scene notes (recorded at index time), not whatever this run uses.
  models: { embedding: MODELS.embedding, flash: store.catalog.models?.describe ?? MODELS.flash, dims: EMBEDDING_DIMS },
  settings: { segment: SEGMENT, ranking: RANKING },
  stats: {
    tours: store.catalog.properties.length,
    scenes: N,
    chapters: store.catalog.properties.reduce((n, p) => n + (p.chapters?.length ?? 0), 0),
    vectors: N * 2,
    minutes: Math.round(store.catalog.properties.reduce((n, p) => n + p.duration, 0) / 60),
    vectorsMB: Math.round(vectorsBytes / 1e5) / 10,
  },
  traces,
  calibration,
  sample: {
    tour: { id: tour.id, name: tour.name, duration: tour.duration, chapters: tour.chapters, windows: tour.segments.map(s => ({ start: s.start, end: s.end })) },
    scene: { ...scene.segment },
    vectors: {
      query: sampleQuery,
      queryHead: head(qv),
      visualHead: head(scene.visual!),
      speechHead: head(scene.speech!),
      cos: { visual: round(dot(qv, scene.visual!)), speech: round(dot(qv, scene.speech!)) },
      contrast: { id: otherScene.segment.id, room: otherScene.segment.rooms?.join(' → ') ?? otherScene.segment.room, visual: round(dot(qv, otherScene.visual!)), speech: round(dot(qv, otherScene.speech!)) },
    },
  },
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`Wrote ${OUT}: ${traces.length} traces (${traces.map(t => t.shortlist.length).join('/')} shortlisted scenes), ${ABSENT.length + PRESENT.length} calibration queries`);
