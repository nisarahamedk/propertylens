/**
 * Runs a fixed set of queries against the built index and prints what comes
 * back, so changes to window length, blend weights or the score floor can be
 * compared before and after.
 *
 * Usage: GEMINI_API_KEY=... npx tsx ingestion/eval.ts
 *
 * Add `expect` (a list of youtubeIds) to a query in eval-queries.json to get a
 * hit@3 check for it.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RANKING } from '../server/config';
import { search } from '../server/search';

interface EvalQuery {
  q: string;
  expect?: string[];
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const queries: EvalQuery[] = JSON.parse(fs.readFileSync(path.join(dir, 'eval-queries.json'), 'utf-8'));

let checked = 0;
let hits = 0;
const topScores: number[] = [];
let empty = 0;

for (const { q, expect } of queries) {
  const r = await search(q);
  const ids = r.matches.map(m => m.property.id);
  const best = r.matches[0]?.moments[0];
  if (best) topScores.push(RANKING.visualWeight * best.signals.visual + RANKING.speechWeight * best.signals.speech);
  else empty++;

  let verdict = '';
  if (expect?.length) {
    checked++;
    const ok = expect.some(id => ids.slice(0, 3).includes(id));
    if (ok) hits++;
    verdict = ok ? ' PASS' : ' MISS';
  }
  console.log(`\n${q}${verdict}  (${r.mode}, ${r.stats.timings.total} ms)`);
  for (const m of r.matches.slice(0, 3)) {
    const top = m.moments[0];
    console.log(`  ${m.property.id}  ${m.property.name.padEnd(28).slice(0, 28)}  ${top?.room ?? '-'}@${top?.start ?? '-'}  visual=${top?.signals.visual ?? 0} speech=${top?.signals.speech ?? 0}`);
  }
}

topScores.sort((a, b) => a - b);
console.log(`\nTop-result blended score: min ${topScores[0]?.toFixed(3)}, median ${topScores[Math.floor(topScores.length / 2)]?.toFixed(3)}, max ${topScores.at(-1)?.toFixed(3)}`);
console.log(`Queries with no results: ${empty}/${queries.length} (floor ${RANKING.minBlended})`);
if (checked) console.log(`hit@3: ${hits}/${checked}`);
