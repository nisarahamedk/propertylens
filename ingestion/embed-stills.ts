/**
 * Embeds the still of every room chapter (public/frames/*_c*.jpg) with Gemini
 * Embedding 2 and writes data/stills.json (server only).
 *
 * A 30s clip embedding blurs a whole walkthrough into one vector, so a single
 * object in one room ("green couch") scores like any other living room. A still
 * of that room keeps it: the right frame stands clearly above the rest.
 *
 * Only stills missing from data/stills.json are embedded, so re-runs are cheap.
 * build-index.ts runs this after writing the catalog.
 *
 * Usage:
 *   GEMINI_API_KEY=... npx tsx ingestion/embed-stills.ts [--concurrency N]
 */

import fs from 'fs';
import path from 'path';
import { CONFIG } from './config';
import { EMBEDDING_DIMS, MODELS } from '../server/config';
import { embed } from '../server/gemini';
import type { Catalog } from '../types';

interface StillFile {
  model: string;
  dims: number;
  stills: Record<string, string>; // frame path -> base64 float32 image embedding
}

const toB64 = (v: Float32Array) => Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64');

export async function embedStills(apiKey: string, concurrency = 2): Promise<void> {
  const catalog: Catalog = JSON.parse(fs.readFileSync(path.join(CONFIG.DATA_DIR, 'properties.json'), 'utf-8'));
  const outPath = path.join(CONFIG.DATA_DIR, 'stills.json');
  const prev: StillFile | null = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf-8')) : null;
  // Vectors from another model or size live in a different space; start over.
  const kept = prev?.model === MODELS.embedding && prev.dims === EMBEDDING_DIMS ? prev.stills : {};

  const frames = [...new Set(catalog.properties.flatMap(p => (p.chapters ?? []).map(c => c.frame).filter(Boolean) as string[]))];
  const stills: Record<string, string> = {};
  for (const f of frames) if (kept[f]) stills[f] = kept[f];
  const todo = frames.filter(f => !stills[f] && fs.existsSync(path.join(CONFIG.FRAMES_DIR, path.basename(f))));
  console.log(`Stills: ${frames.length} in the catalog, ${todo.length} to embed`);

  const save = () => fs.writeFileSync(outPath, JSON.stringify({ model: MODELS.embedding, dims: EMBEDDING_DIMS, stills }));
  let done = 0;
  const queue = [...todo];
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const data = fs.readFileSync(path.join(CONFIG.FRAMES_DIR, path.basename(f))).toString('base64');
      stills[f] = toB64(await embed([{ inlineData: { mimeType: 'image/jpeg', data } }], apiKey));
      if (++done % 50 === 0) {
        save();
        console.log(`  ${done}/${todo.length}`);
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: concurrency }, worker));
  } finally {
    save(); // keep what finished, so a quota stop resumes where it ended
  }
  console.log(`Wrote ${Object.keys(stills).length} stills to ${outPath}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Set GEMINI_API_KEY.');
    process.exit(1);
  }
  process.env.GEMINI_MAX_ATTEMPTS ??= '10';
  process.env.GEMINI_MAX_WAIT_MS ??= '90000';
  const i = process.argv.indexOf('--concurrency');
  embedStills(apiKey, i >= 0 ? Number(process.argv[i + 1]) : 2).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}
