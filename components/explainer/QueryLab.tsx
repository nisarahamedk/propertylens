import React, { useMemo, useState } from 'react';
import { formatPrice } from '../../lib/format';
import type { SearchFilters } from '../../types';
import { data, fmtTime, type TraceRow } from './shared';

const R = data.settings.ranking;
const DEFAULTS = { wv: R.rrf.visual, ws: R.rrf.speech, wk: R.rrf.keyword, blend: R.visualWeight, floor: R.minBlended, exact: true };
type Knobs = typeof DEFAULTS;

interface Ranked extends TraceRow { fused: number; blended: number; pass: 'floor' | 'words' | null; ranks: [number, number, number] }

/**
 * Same arithmetic as server/search.ts. Ranks come from the snapshot (computed over
 * every candidate), and rank fusion depends on ranks rather than weights, so
 * re-weighting here is exact.
 */
function rank(rows: TraceRow[], k: Knobs): { rows: Ranked[]; results: Ranked[] } {
  const K = R.rrf.k;
  const out: Ranked[] = rows.map(r => {
    const ranks = r.ranks.map(x => x ?? Infinity) as [number, number, number];
    const fused = k.wv / (K + ranks[0]) + k.ws / (K + ranks[1]) + k.wk / (K + ranks[2]);
    const blended = k.blend * r.visual + (1 - k.blend) * r.speech;
    const pass: Ranked['pass'] = blended >= k.floor ? 'floor' : k.exact && r.allWords ? 'words' : null;
    return { ...r, fused, blended, pass, ranks };
  }).sort((a, b) => b.fused - a.fused);
  const seen = new Set<string>();
  const results = out.filter(r => r.pass && !seen.has(r.tour) && seen.add(r.tour)).slice(0, 5);
  return { rows: out, results };
}

function filterChips(f: SearchFilters): string[] {
  const c: string[] = [];
  if (f.minBeds) c.push(`beds ≥ ${f.minBeds}`);
  if (f.minBaths) c.push(`baths ≥ ${f.minBaths}`);
  if (f.maxPrice) c.push(`price ≤ ${formatPrice(f.maxPrice)}`);
  if (f.minPrice) c.push(`price ≥ ${formatPrice(f.minPrice)}`);
  for (const l of f.locations ?? []) c.push(`area = ${l}`);
  return c;
}

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }> = ({ label, value, min, max, step, onChange, fmt = v => v.toFixed(2) }) => (
  <label className="block">
    <span className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-olive">
      <span>{label}</span><span className="text-charcoal font-bold">{fmt(value)}</span>
    </span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-terracotta" />
  </label>
);

const Bar: React.FC<{ value: number; max?: number; floor?: number }> = ({ value, max = 1 }) => (
  <span className="block h-1.5 bg-sand w-full">
    <span className="block h-full bg-charcoal" style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%` }} />
  </span>
);

const QueryLab: React.FC = () => {
  const [qi, setQi] = useState(0);
  const [k, setK] = useState<Knobs>(DEFAULTS);
  const trace = data.traces[qi];
  const { rows, results } = useMemo(() => rank(trace.shortlist, k), [trace, k]);
  const changed = JSON.stringify(k) !== JSON.stringify(DEFAULTS);
  const chips = filterChips(trace.filters);
  const set = (patch: Partial<Knobs>) => setK(prev => ({ ...prev, ...patch }));
  // Cosines live in a narrow band; scale bars from 0.45 so differences are visible.
  const cos = (v: number) => Math.max(0, (v - 0.45) / 0.35);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {data.traces.map((t, i) => (
          <button
            key={t.query}
            onClick={() => setQi(i)}
            aria-pressed={qi === i}
            className={`px-3 py-1.5 border-2 border-charcoal text-sm ${qi === i ? 'bg-charcoal text-warmWhite' : 'bg-warmWhite hover:bg-sand'}`}
          >
            {t.query}
          </button>
        ))}
      </div>

      {/* 1-2: parse and filter */}
      <ol className="grid md:grid-cols-3 gap-3 text-sm">
        <li className="border-2 border-charcoal bg-warmWhite p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-olive mb-2">1 · Parse</p>
          <p className="mb-2"><span className="px-1.5 py-0.5 bg-charcoal text-warmWhite font-mono text-xs">{trace.semantic}</span></p>
          <p className="flex flex-wrap gap-1">
            {chips.length ? chips.map(c => <span key={c} className="px-1.5 py-0.5 border-2 border-charcoal font-mono text-xs font-bold">{c}</span>) : <span className="font-mono text-xs text-olive">no filters → model skipped</span>}
          </p>
        </li>
        <li className="border-2 border-charcoal bg-warmWhite p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-olive mb-2">2 · Filter</p>
          <p><strong className="font-display text-2xl">{trace.candidates}</strong> of {data.stats.scenes} scenes</p>
          <p className="text-charcoal/70 text-xs">in {trace.candidateTours} tours pass the hard filters before any vector math</p>
        </li>
        <li className="border-2 border-charcoal bg-warmWhite p-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-olive mb-2">3 · Embed + score · {(trace.timings.embed ?? 0) + (trace.timings.rank ?? 0)} ms</p>
          <p>Query embedded once ({trace.timings.embed} ms), then {trace.candidates * 2} dot products + BM25 ({trace.timings.rank} ms)</p>
        </li>
      </ol>

      {/* 4-6: fuse, gate, group */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 min-w-0 border-2 border-charcoal bg-warmWhite">
          <p className="px-3 pt-3 font-mono text-[10px] font-bold uppercase tracking-widest text-olive">
            4 · Fuse · 5 · Gate — shortlist of {rows.length} scenes, ordered by fused score
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs mt-2">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-wider text-olive text-left">
                  <th className="px-3 py-1 font-normal">Scene</th>
                  <th className="px-2 py-1 font-normal w-20">Seen</th>
                  <th className="px-2 py-1 font-normal w-20">Heard</th>
                  <th className="px-2 py-1 font-normal w-20">Words</th>
                  <th className="px-2 py-1 font-normal text-right">Blend</th>
                  <th className="px-3 py-1 font-normal">Gate</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map(r => (
                  <tr key={r.id} className={`border-t border-charcoal/10 ${r.pass ? '' : 'opacity-45'}`}>
                    <td className="px-3 py-1.5 min-w-[9rem]">
                      <span className="font-semibold text-charcoal">{r.name.slice(0, 22)}</span>
                      <span className="block font-mono text-[10px] text-olive">{fmtTime(r.start)} · {(r.rooms ?? [r.room]).slice(0, 2).join(' → ')}</span>
                    </td>
                    <td className="px-2" title={`cos ${r.visual} · rank ${r.ranks[0]}`}><Bar value={cos(r.visual)} /></td>
                    <td className="px-2" title={`cos ${r.speech} · rank ${r.ranks[1]}`}><Bar value={cos(r.speech)} /></td>
                    <td className="px-2" title={`BM25 ${r.keyword} · rank ${r.ranks[2] === Infinity ? '–' : r.ranks[2]}`}><Bar value={r.keyword} /></td>
                    <td className="px-2 text-right font-mono tabular-nums">{r.blended.toFixed(3)}</td>
                    <td className="px-3 font-mono text-[10px] uppercase whitespace-nowrap">
                      {r.pass === 'floor' ? <span className="text-charcoal">✓ floor</span> : r.pass === 'words' ? <span className="text-terracotta">✓ words</span> : '✕'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 font-mono text-[10px] text-olive">Hover a bar for the raw cosine or BM25 and its rank among all candidates. Re-weighting is exact: fusion depends on ranks, which the weights do not change.</p>
        </div>

        <div className="min-w-0 border-2 border-charcoal bg-warmWhite p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-olive">Knobs</p>
            {changed && <button onClick={() => setK(DEFAULTS)} className="font-mono text-[10px] uppercase underline">Reset</button>}
          </div>
          <p className="text-xs text-charcoal/75">Rank fusion weights (k = {R.rrf.k})</p>
          <Slider label="Seen" value={k.wv} min={0} max={2} step={0.1} onChange={v => set({ wv: v })} fmt={v => v.toFixed(1)} />
          <Slider label="Heard" value={k.ws} min={0} max={2} step={0.1} onChange={v => set({ ws: v })} fmt={v => v.toFixed(1)} />
          <Slider label="Words (BM25)" value={k.wk} min={0} max={2} step={0.1} onChange={v => set({ wk: v })} fmt={v => v.toFixed(1)} />
          <p className="text-xs text-charcoal/75 pt-1">Relevance gate</p>
          <Slider label="Blend: seen share" value={k.blend} min={0} max={1} step={0.05} onChange={v => set({ blend: v })} />
          <Slider label="Floor" value={k.floor} min={0.55} max={0.75} step={0.005} onChange={v => set({ floor: v })} fmt={v => v.toFixed(3)} />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={k.exact} onChange={e => set({ exact: e.target.checked })} className="accent-terracotta" />
            Exact-word bypass
          </label>
        </div>
      </div>

      {/* 6: group into tours */}
      <div>
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-olive mb-2">
          6 · Group — best passing moment per tour {changed ? '(with your knobs)' : '(production settings)'}
        </p>
        {results.length ? (
          <ol className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {results.map((r, i) => (
              <li key={r.id} className="border-2 border-charcoal bg-warmWhite">
                {r.frame && <img src={r.frame} alt="" loading="lazy" className="w-full aspect-video object-cover border-b-2 border-charcoal" />}
                <p className="p-2 text-xs leading-snug">
                  <span className="font-mono font-bold mr-1">{i + 1}</span>{r.name.slice(0, 20)}
                  <span className="block font-mono text-[10px] text-olive">{fmtTime(r.start)} · {r.pass === 'words' ? 'exact words' : r.blended.toFixed(3)}</span>
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="border-2 border-dashed border-charcoal/40 p-4 text-sm text-charcoal/80">Nothing clears the gate. In the app this becomes “No exact match” with the closest moments when filters are set, or no results otherwise.</p>
        )}
      </div>
    </div>
  );
};

export default QueryLab;
