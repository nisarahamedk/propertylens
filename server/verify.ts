// Second stage of retrieval: a multimodal model reads the top results (each
// scene's room picture, caption and transcript) and says whether it really
// shows what was searched for, quoting the words that prove it. Embeddings
// find "white quartz countertops, black fixtures" close to "black countertops";
// the model can tell the countertops are white.

import fs from 'fs';
import path from 'path';
import type { Moment, PropertyMatch, Verification } from '../types.js';
import { generateJson, type Part } from './gemini.js';

const MAX_CHECKED = 8;

const SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: ['yes', 'partly', 'no'] },
          seen: { type: 'string', description: 'Shortest exact quote from the caption that shows the search, or empty.' },
          said: { type: 'string', description: 'Shortest exact quote from the transcript that says it, or empty.' },
          inPhoto: { type: 'boolean', description: 'The photo itself clearly shows it.' },
          missing: { type: 'string', description: 'For partly: the part of the search not confirmed, in the buyer\'s words. Else empty.' },
        },
        required: ['id', 'verdict', 'seen', 'said', 'inPhoto', 'missing'],
      },
    },
  },
  required: ['results'],
};

const SYSTEM =
  'You check results from a home-tour video search. For each scene you get a photo of the room, ' +
  'a caption describing that part of the video, and what the agent says. Decide whether the scene shows or mentions what the buyer searched for. ' +
  'Judge meaning, not shared words: "dark countertops" satisfies "black countertops"; "white quartz countertops, black fixtures" does not, ' +
  'because the countertops are white. Colours, materials and other details must belong to the thing searched for. ' +
  'Use the photo as evidence: if it plainly shows the thing (a teal sofa for "green couch"), that counts even when the caption omits it. ' +
  'verdict: "yes" when everything searched for is confirmed, "partly" when the main thing is there but a detail is unconfirmed (not contradicted), ' +
  '"no" when it is absent or contradicted. The photo is one moment and may show another part of the room: it never cancels what the caption or agent confirms. ' +
  'Quotes must be copied exactly from the caption or transcript, 2 to 8 words, and only the words that prove the match.';

function frameData(frame?: string): Part | null {
  if (!frame) return null;
  const file = path.join(process.cwd(), 'public', 'frames', path.basename(frame));
  if (!fs.existsSync(file)) return null;
  return { inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(file).toString('base64') } };
}

/** The exact text the quote points at, or undefined when the model paraphrased. */
function grounded(quote: string, text: string): string | undefined {
  const q = quote.trim().replace(/^["“']|["”']$/g, '');
  if (!q) return undefined;
  const at = text.toLowerCase().indexOf(q.toLowerCase());
  return at >= 0 ? text.slice(at, at + q.length) : undefined;
}

const cache = new Map<string, Map<string, Verification | null>>();
const CACHE_SIZE = 500;

/**
 * Verdicts for the best moment of each of the top results, keyed by property id
 * (null means "no"). Throws when the model is unavailable; callers keep the
 * unverified results then.
 */
export async function verifyMatches(key: string, semantic: string, matches: PropertyMatch[], apiKey: string): Promise<Map<string, Verification | null>> {
  const top = matches.slice(0, MAX_CHECKED).filter(m => m.moments[0]);
  const cacheKey = `${key}|${top.map(m => m.moments[0].segmentId).join(',')}`;
  const hit = cache.get(cacheKey);
  if (hit) return hit;

  const parts: Part[] = [{ text: `The buyer searched for: "${semantic}"\n\nScenes:` }];
  const byId = new Map<string, Moment>();
  top.forEach((m, i) => {
    const id = `s${i + 1}`;
    const moment = m.moments[0];
    byId.set(id, moment);
    const photo = frameData(moment.frame);
    parts.push({ text: `\n[${id}] ${moment.label ?? moment.room}${photo ? ' (photo below)' : ''}\nCaption: ${moment.caption}\nAgent says: ${moment.transcript || '(nothing)'}` });
    if (photo) parts.push(photo);
  });

  const out = await generateJson<{ results: { id: string; verdict: string; seen: string; said: string; inPhoto: boolean; missing: string }[] }>(
    [{ role: 'user', parts }],
    apiKey,
    { schema: SCHEMA, system: SYSTEM, temperature: 0 },
  );

  const verdicts = new Map<string, Verification | null>();
  for (const r of out.results ?? []) {
    const moment = byId.get(r.id);
    if (!moment) continue;
    const propertyId = top[Number(r.id.slice(1)) - 1].property.id;
    if (r.verdict === 'no') {
      verdicts.set(propertyId, null);
      continue;
    }
    verdicts.set(propertyId, {
      verdict: r.verdict === 'yes' ? 'yes' : 'partly',
      seen: grounded(r.seen ?? '', moment.caption),
      said: grounded(r.said ?? '', moment.transcript),
      pictured: Boolean(r.inPhoto),
      missing: r.verdict === 'partly' && r.missing?.trim() ? r.missing.trim() : undefined,
    });
  }
  if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, verdicts);
  return verdicts;
}
