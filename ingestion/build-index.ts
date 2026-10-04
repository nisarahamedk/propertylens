/**
 * Builds the PropertyLens search index from the videos in manifest.json.
 *
 * For each tour video:
 *   1. check it is still public on YouTube and download it (yt-dlp)
 *   2. cut 30s windows every 25s (ffmpeg) and save a still from each
 *   3. describe each window with Gemini Flash (room, caption, features, transcript)
 *   4. embed the clip itself and its description with Gemini Embedding 2
 * then writes data/properties.json (catalog + scenes, shipped to the browser)
 * and data/vectors.json (server only).
 *
 * Results are cached per window in ingestion/.cache, so an interrupted run
 * resumes where it stopped and re-runs only pay for new videos.
 *
 * Usage:
 *   GEMINI_API_KEY=... npx tsx ingestion/build-index.ts [--only <youtubeId>] [--limit N] [--skip-check] [--concurrency N]
 *   npx tsx ingestion/build-index.ts --catalog-only   # no downloads or API calls; rebuild outputs from cache
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { CONFIG, type VideoManifest, type VideoManifestEntry } from './config';
import { EMBEDDING_DIMS, MODELS, SEGMENT } from '../server/config';
import { documentText, embed, generateJson } from '../server/gemini';
import type { Catalog, Chapter, Property, Room, Segment } from '../types';

const ROOMS: Room[] = [
  'exterior', 'entry', 'living', 'dining', 'kitchen', 'bedroom', 'bathroom', 'office',
  'basement', 'laundry', 'garage', 'backyard', 'view', 'amenity', 'other',
];

interface CachedSegment {
  room: Room;
  caption: string;
  features: string[];
  transcript: string;
  v: string; // base64 float32 clip embedding
  t: string; // base64 float32 text embedding
  frameAt?: number; // second the saved still was taken at
}

interface VideoCache {
  duration?: number;
  available?: boolean;
  segments: Record<string, CachedSegment>; // keyed by start second
  summary?: { summary: string; highlights: string[] };
  chapters?: Chapter[];
}

// ---------- args ----------

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const CATALOG_ONLY = flag('--catalog-only');
const SKIP_CHECK = flag('--skip-check');
const ONLY = option('--only');
const LIMIT = option('--limit') ? Number(option('--limit')) : undefined;
// Use 1 on the Gemini free tier (15 Flash-Lite and 100 embedding requests per minute).
const CONCURRENCY = Number(option('--concurrency') ?? 2);

// ---------- helpers ----------

const apiKey = process.env.GEMINI_API_KEY || '';
const pad = (n: number) => String(n).padStart(4, '0');
const toB64 = (v: Float32Array) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64');

function readCache(id: string): VideoCache {
  const file = path.join(CONFIG.CACHE_DIR, `${id}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : { segments: {} };
}

function writeCache(id: string, cache: VideoCache) {
  fs.mkdirSync(CONFIG.CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CONFIG.CACHE_DIR, `${id}.json`), JSON.stringify(cache));
}

/** "$1.65 m" -> 1650000. Values under $10k with no unit are scraping noise and are dropped. */
export function parsePrice(raw?: string): number | undefined {
  if (!raw) return undefined;
  const m = raw.toLowerCase().replace(/,/g, '').match(/\$?\s*(\d+(?:\.\d+)?)\s*(m|k)?/);
  if (!m) return undefined;
  const n = parseFloat(m[1]) * (m[2] === 'm' ? 1_000_000 : m[2] === 'k' ? 1_000 : 1);
  return n >= 10_000 ? n : undefined;
}

/** Window start/end pairs covering the whole video. */
export function windows(duration: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let start = 0; start < duration; start += SEGMENT.step) {
    const end = Math.min(duration, start + SEGMENT.length);
    if (out.length && end - start < SEGMENT.minTail) break;
    out.push([start, Math.round(end * 10) / 10]);
    if (end >= duration) break;
  }
  return out;
}

async function isAvailable(youtubeId: string): Promise<boolean> {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}`;
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return true; // network trouble is not proof the video is gone
  }
}

function ensureDownloaded(youtubeId: string): string {
  const out = path.join(CONFIG.VIDEOS_DIR, `${youtubeId}.mp4`);
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(CONFIG.VIDEOS_DIR, { recursive: true });
  console.log(`  downloading ${youtubeId}`);
  execFileSync('yt-dlp', [
    '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
    '--merge-output-format', 'mp4', '--no-playlist', '-o', out,
    `https://www.youtube.com/watch?v=${youtubeId}`,
  ], { stdio: 'inherit' });
  return out;
}

function probeDuration(file: string): number {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
  ]).toString();
  return parseFloat(out);
}

/** Cuts a small 360p clip for the API. Returns its path in a temp dir. */
export function cutClip(file: string, start: number, end: number, outDir: string): string {
  const out = path.join(outDir, `${path.basename(file, '.mp4')}_${pad(start)}.mp4`);
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-ss', String(start), '-i', file, '-t', String(end - start),
    '-vf', 'scale=-2:360', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30',
    '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', out,
  ]);
  return out;
}

/**
 * The whole tour at 240p and 2 fps, small enough to send in one request, with a
 * running M:SS clock burned into the corner. Reading the clock keeps the model's
 * timestamps from drifting on fast-cut cinematic tours.
 */
function cutWhole(file: string, outDir: string): string {
  const out = path.join(outDir, `${path.basename(file, '.mp4')}_whole.mp4`);
  const clock = "drawtext=text='%{eif\\:floor(t/60)\\:d}\\:%{eif\\:mod(floor(t)\\,60)\\:d\\:2}':x=6:y=6:fontsize=22:fontcolor=yellow:box=1:boxcolor=black@0.7";
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', file, '-vf', `scale=-2:240,fps=2,${clock}`, '-c:v', 'libx264', '-preset', 'veryfast',
    '-crf', '34', '-c:a', 'aac', '-ac', '1', '-b:a', '32k', '-movflags', '+faststart', out,
  ]);
  return out;
}

export function extractFrame(file: string, at: number, out: string, overwrite = false) {
  if (fs.existsSync(out) && !overwrite) return;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-ss', String(at), '-i', file, '-frames:v', '1',
    '-vf', 'scale=480:-2', '-q:v', '6', out,
  ]);
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

// ---------- Gemini steps ----------

const DESCRIBE_SCHEMA = {
  type: 'object',
  properties: {
    room: { type: 'string', enum: ROOMS },
    caption: { type: 'string', description: 'One or two sentences on what is visible: the space, finishes, materials, light, views.' },
    features: { type: 'array', items: { type: 'string' }, description: '3 to 8 short noun phrases a buyer might search for.' },
    transcript: { type: 'string', description: 'Verbatim speech in the clip, or an empty string if there is only music.' },
  },
  required: ['room', 'caption', 'features', 'transcript'],
};

async function describeClip(clipB64: string, video: VideoManifestEntry) {
  return generateJson<Omit<CachedSegment, 'v' | 't'>>(
    [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'video/mp4', data: clipB64 } },
        { text: `This is a 30 second clip from a real estate tour titled "${video.title}". Describe it for a home search index. Name the main room shown. Be concrete about materials and finishes (e.g. "white quartz island", "wide-plank oak floors"). Do not invent details you cannot see or hear.` },
      ],
    }],
    apiKey,
    { schema: DESCRIBE_SCHEMA, temperature: 0.1 },
  );
}

const CHAPTERS_SCHEMA = {
  type: 'object',
  properties: {
    chapters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          start: { type: 'string', description: 'M:SS when this space first appears on screen' },
          room: { type: 'string', enum: ROOMS },
          label: { type: 'string', description: '1 to 3 words, e.g. "Kitchen", "Primary bedroom", "Ensuite", "Balcony"' },
        },
        required: ['start', 'room', 'label'],
      },
    },
  },
  required: ['chapters'],
};

const parseStamp = (s: string) => {
  const parts = String(s).trim().split(':').map(Number);
  return parts.some(Number.isNaN) ? NaN : parts.reduce((acc, n) => acc * 60 + n, 0);
};

/** Turns the model's chapter starts into a gap-free timeline from 0 to the end of the video. */
export function normalizeChapters(raw: { start: string; room: string; label: string }[], duration: number): Chapter[] {
  const items = raw
    .map(c => ({ start: parseStamp(c.start), room: (ROOMS.includes(c.room as Room) ? c.room : 'other') as Room, label: c.label.trim() || c.room }))
    .filter(c => c.start >= 0 && c.start < duration)
    .sort((a, b) => a.start - b.start);
  const out: Chapter[] = [];
  for (const c of items) {
    const last = out[out.length - 1];
    // Same space twice in a row, or a blip under 2s: extend the previous chapter instead.
    if (last && ((last.room === c.room && last.label.toLowerCase() === c.label.toLowerCase()) || c.start - last.start < 2)) continue;
    out.push({ ...c, end: duration });
  }
  if (!out.length) return [];
  out[0].start = 0;
  for (let i = 0; i < out.length - 1; i++) out[i].end = out[i + 1].start;
  out[out.length - 1].end = Math.round(duration * 10) / 10;
  return out;
}

async function describeChapters(file: string, duration: number, tmp: string): Promise<Chapter[]> {
  const whole = cutWhole(file, tmp);
  try {
    const out = await generateJson<{ chapters: { start: string; room: string; label: string }[] }>(
      [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'video/mp4', data: fs.readFileSync(whole).toString('base64') } },
          { text: `This is a ${Math.round(duration)}-second real estate tour video. List every change of space in order: each time the camera moves into a different room or area, start a new chapter at the moment it first appears. Use "backyard" for balconies, decks, patios and yards, "amenity" only for shared building facilities, and "other" for title cards, logos, agent talking heads and maps. Be precise with timestamps; chapters are often only 5 to 15 seconds long. Do not merge different rooms. A clock in the top-left corner of every frame shows the exact time (M:SS); read your timestamps from it.` },
        ],
      }],
      apiKey,
      { schema: CHAPTERS_SCHEMA, temperature: 0 },
    );
    return normalizeChapters(out.chapters ?? [], duration);
  } finally {
    fs.rmSync(whole, { force: true });
  }
}

/** The chapter covering most of [start, end] (rooms before "other"), and the middle of that overlap, where its still is taken. */
export function mainChapter(chapters: Chapter[], start: number, end: number): { chapter: Chapter; at: number } | null {
  let best: { chapter: Chapter; at: number; overlap: number } | null = null;
  for (const c of chapters) {
    const from = Math.max(start, c.start), to = Math.min(end, c.end);
    // Title cards, logos and talking heads make poor thumbnails; any real room wins.
    const overlap = (to - from) * (c.room === 'other' ? 0.25 : 1);
    if (overlap > (best?.overlap ?? 0)) best = { chapter: c, at: Math.round((from + to) / 2 * 10) / 10, overlap };
  }
  return best && { chapter: best.chapter, at: best.at };
}

/** Labels of the chapters a window passes through (at least 3s on screen), in order. */
export function chaptersIn(chapters: Chapter[], start: number, end: number): string[] | undefined {
  const labels = chapters
    .filter(c => c.room !== 'other' && Math.min(end, c.end) - Math.max(start, c.start) >= 3)
    .map(c => c.label);
  return labels.length ? labels : undefined;
}

async function summarize(property: Property) {
  const notes = property.segments.map(s => `${s.room}: ${s.caption}`).join('\n');
  return generateJson<{ summary: string; highlights: string[] }>(
    [{ role: 'user', parts: [{ text: `Scene notes from a tour of ${property.name}:\n${notes}` }] }],
    apiKey,
    {
      temperature: 0.2,
      system: 'Write a two-sentence summary of the home for a buyer, and 3 to 5 short highlights (under 6 words each). Use only the notes.',
      schema: {
        type: 'object',
        properties: { summary: { type: 'string' }, highlights: { type: 'array', items: { type: 'string' } } },
        required: ['summary', 'highlights'],
      },
    },
  );
}

// ---------- main ----------

function baseProperty(video: VideoManifestEntry, duration: number): Property {
  const m = video.metadata;
  const location = m.location || 'British Columbia';
  return {
    id: video.youtubeId,
    youtubeId: video.youtubeId,
    // The title is a last resort: it is usually a sales headline, not a place.
    name: (m.location || m.address || video.title).replace(/_/g, ' '),
    address: m.address || location,
    location,
    beds: m.beds || 0,
    baths: m.baths || 0,
    sqft: m.sqft || 0,
    price: parsePrice(m.price) ? m.price!.trim() : undefined,
    priceValue: parsePrice(m.price),
    thumbnailUrl: video.thumbnailUrl,
    description: video.description,
    channelName: video.channelName,
    duration: Math.round(duration || video.duration),
    segments: [],
  };
}

/** Indexes one tour, or with `offline` only rebuilds its outputs from the cache. */
async function indexVideo(video: VideoManifestEntry, tmp: string, offline = CATALOG_ONLY): Promise<Property | null> {
  const id = video.youtubeId;
  const cache = readCache(id);

  if (!offline) {
    if (!SKIP_CHECK) {
      cache.available = await isAvailable(id);
      writeCache(id, cache);
    }
    if (cache.available === false) {
      console.log(`  skipped: no longer public on YouTube`);
      return null;
    }
    const file = ensureDownloaded(id);
    cache.duration ??= probeDuration(file);
    const todo = windows(cache.duration).filter(([start]) => !cache.segments[start]);
    console.log(`  ${windows(cache.duration).length} windows, ${todo.length} to index`);

    await pool(todo, CONCURRENCY, async ([start, end]) => {
      const clip = cutClip(file, start, end, tmp);
      extractFrame(file, (start + end) / 2, path.join(CONFIG.FRAMES_DIR, `${id}_${pad(start)}.jpg`));
      const clipB64 = fs.readFileSync(clip).toString('base64');
      const [desc, v] = await Promise.all([
        describeClip(clipB64, video),
        embed([{ inlineData: { mimeType: 'video/mp4', data: clipB64 } }], apiKey),
      ]);
      const room = ROOMS.includes(desc.room) ? desc.room : 'other';
      const text = `${room}. ${desc.caption} Features: ${desc.features.join(', ')}.${desc.transcript ? ` Said: ${desc.transcript}` : ''}`;
      const t = await embed([{ text: documentText(video.metadata.location || video.title, text) }], apiKey);
      cache.segments[start] = { ...desc, room, v: toB64(v), t: toB64(t) };
      writeCache(id, cache);
      fs.rmSync(clip, { force: true });
      process.stdout.write('.');
    });
    if (todo.length) process.stdout.write('\n');

    // Rooms change every 5-15s in most tours, far more often than the 30s search
    // windows, so the room timeline comes from one pass over the whole video.
    if (!cache.chapters) {
      cache.chapters = await describeChapters(file, cache.duration, tmp);
      writeCache(id, cache);
      console.log(`  ${cache.chapters.length} chapters`);
    }
  } else if (cache.available === false) {
    return null;
  }

  const property = baseProperty(video, cache.duration ?? video.duration);
  const chapters = cache.chapters ?? [];
  const videoFile = path.join(CONFIG.VIDEOS_DIR, `${id}.mp4`);
  let framesMoved = false;
  property.segments = Object.keys(cache.segments)
    .map(Number)
    .sort((a, b) => a - b)
    .map((start): Segment => {
      const c = cache.segments[start];
      const end = Math.min(property.duration, start + SEGMENT.length);
      const frame = `${id}_${pad(start)}.jpg`;
      // Label a window by the room it mostly shows, and take its still inside that
      // room, so the thumbnail, the label and the timeline agree.
      const main = mainChapter(chapters, start, end);
      if (main && c.frameAt !== main.at && fs.existsSync(videoFile)) {
        extractFrame(videoFile, main.at, path.join(CONFIG.FRAMES_DIR, frame), true);
        c.frameAt = main.at;
        framesMoved = true;
      }
      return {
        id: `${id}:${pad(start)}`,
        start,
        end,
        room: main?.chapter.room ?? c.room,
        rooms: chaptersIn(chapters, start, end),
        caption: c.caption,
        features: c.features,
        transcript: c.transcript,
        frame: fs.existsSync(path.join(CONFIG.FRAMES_DIR, frame)) ? `/frames/${frame}` : undefined,
      };
    });

  if (framesMoved) writeCache(id, cache);
  if (chapters.length) property.chapters = chapters;

  if (property.segments.length && !cache.summary && !offline) {
    cache.summary = await summarize(property);
    writeCache(id, cache);
  }
  property.summary = cache.summary?.summary;
  property.highlights = cache.summary?.highlights;
  return property;
}

async function main() {
  // Indexing is offline, so ride out per-minute rate limits instead of failing.
  process.env.GEMINI_MAX_ATTEMPTS ??= '10';
  process.env.GEMINI_MAX_WAIT_MS ??= '90000';
  if (!CATALOG_ONLY && !apiKey) {
    console.error('Set GEMINI_API_KEY, or pass --catalog-only to rebuild outputs from cache.');
    process.exit(1);
  }
  const manifest: VideoManifest = JSON.parse(fs.readFileSync(CONFIG.MANIFEST_PATH, 'utf-8'));
  let videos = manifest.videos;
  if (ONLY) videos = videos.filter(v => v.youtubeId === ONLY);
  if (LIMIT) videos = videos.slice(0, LIMIT);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'propertylens-'));
  const properties: Property[] = [];
  const vectors: Record<string, { v: string; t: string }> = {};
  const failed: string[] = [];

  const collect = (video: VideoManifestEntry, property: Property) => {
    properties.push(property);
    const cache = readCache(video.youtubeId);
    for (const s of property.segments) {
      const c = cache.segments[s.start];
      vectors[s.id] = { v: c.v, t: c.t };
    }
  };
  for (const [i, video] of videos.entries()) {
    console.log(`[${i + 1}/${videos.length}] ${video.title}`);
    try {
      const property = await indexVideo(video, tmp);
      if (property) collect(video, property);
    } catch (e) {
      failed.push(video.youtubeId);
      console.error(`  failed: ${(e as Error).message}`);
      // Keep what is already indexed rather than dropping the tour from the outputs.
      const cached = await indexVideo(video, tmp, true).catch(() => null);
      if (cached?.segments.length) collect(video, cached);
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  // With --only/--limit, merge into the existing outputs instead of replacing them.
  const partial = Boolean(ONLY || LIMIT);
  const catalogPath = path.join(CONFIG.DATA_DIR, 'properties.json');
  const vectorPath = path.join(CONFIG.DATA_DIR, 'vectors.json');
  let allProperties = properties;
  let allVectors = vectors;
  if (partial && fs.existsSync(catalogPath)) {
    const prev: Catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    const ids = new Set(properties.map(p => p.id));
    allProperties = [...prev.properties.filter(p => !ids.has(p.id)), ...properties];
    if (fs.existsSync(vectorPath)) {
      allVectors = { ...JSON.parse(fs.readFileSync(vectorPath, 'utf-8')).segments, ...vectors };
    }
  }
  const order = new Map(manifest.videos.map((v, i) => [v.youtubeId, i]));
  allProperties.sort((a, b) => order.get(a.id)! - order.get(b.id)!);

  fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
  const catalog: Catalog = {
    generatedAt: new Date().toISOString(),
    models: { embedding: MODELS.embedding, describe: MODELS.flash, dims: EMBEDDING_DIMS },
    properties: allProperties,
  };
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 1) + '\n');
  if (Object.keys(allVectors).length) {
    fs.writeFileSync(vectorPath, JSON.stringify({ model: MODELS.embedding, dims: EMBEDDING_DIMS, segments: allVectors }));
  }

  const segCount = allProperties.reduce((n, p) => n + p.segments.length, 0);
  console.log(`\nWrote ${allProperties.length} properties and ${segCount} scenes to ${CONFIG.DATA_DIR}`);
  if (failed.length) {
    // Finished windows are cached, so re-running the same command resumes these.
    console.error(`${failed.length} video(s) failed: ${failed.join(', ')}. Re-run to resume them.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
