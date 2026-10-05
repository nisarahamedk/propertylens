import React, { useState } from 'react';
import { data, useInView } from './shared';

// Validated pair (scripts/validate_palette.js, light, on #FDFCFA): both pass CVD and contrast.
const COLORS = { absent: '#3F7FB0', present: '#C67B5C' };
const LABELS = { absent: 'Queries for things no tour has', present: 'Queries for common features' };
const MIN = 0.56, MAX = 0.73;
const x = (v: number) => `${((v - MIN) / (MAX - MIN)) * 100}%`;
const floor = data.settings.ranking.minBlended;

type Kind = keyof typeof COLORS;

/** Stack dots that would overlap so every query stays visible. */
function layout(points: { query: string; top: number }[]) {
  const placed: { query: string; top: number; lane: number }[] = [];
  for (const p of [...points].sort((a, b) => a.top - b.top)) {
    let lane = 0;
    while (placed.some(q => q.lane === lane && Math.abs(q.top - p.top) < 0.0045)) lane++;
    placed.push({ ...p, lane });
  }
  return placed;
}

const Calibration: React.FC = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const [hover, setHover] = useState<{ kind: Kind; query: string; top: number } | null>(null);
  const [table, setTable] = useState(false);
  const rows: Kind[] = ['absent', 'present'];
  const cleared = (k: Kind) => data.calibration[k].filter(p => p.top >= floor).length;

  return (
    <div ref={ref} className="bg-warmWhite border-2 border-charcoal p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="font-display font-bold text-charcoal">Best-matching scene per query (blended cosine)</p>
        <div className="flex items-center gap-4 font-mono text-[11px] text-charcoal">
          {rows.map(k => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[k] }} />
              {k === 'absent' ? 'Absent' : 'Present'}
            </span>
          ))}
          <button onClick={() => setTable(t => !t)} className="underline uppercase text-[10px] tracking-widest">{table ? 'Chart' : 'Table'}</button>
        </div>
      </div>

      {table ? (
        <table className="w-full text-sm">
          <thead><tr className="text-left font-mono text-[10px] uppercase tracking-widest text-olive"><th className="py-1 font-normal">Query</th><th className="font-normal">Kind</th><th className="font-normal text-right">Top score</th></tr></thead>
          <tbody>
            {rows.flatMap(k => data.calibration[k].map(p => (
              <tr key={k + p.query} className="border-t border-charcoal/10"><td className="py-1">{p.query}</td><td className="font-mono text-xs">{k}</td><td className="text-right font-mono tabular-nums">{p.top.toFixed(3)}</td></tr>
            )))}
          </tbody>
        </table>
      ) : (
        <div className="relative pl-0 md:pl-44">
          {rows.map(k => {
            const pts = layout(data.calibration[k]);
            const lanes = Math.max(...pts.map(p => p.lane)) + 1;
            return (
              <div key={k} className="mb-4">
                <p className="md:absolute md:left-0 md:w-40 font-mono text-[10px] uppercase tracking-widest text-charcoal mb-1 md:mb-0 md:mt-1">
                  {LABELS[k]} <span className="text-olive">({cleared(k)}/{data.calibration[k].length} clear the floor)</span>
                </p>
                <div className="relative border-b border-charcoal/20" style={{ height: lanes * 14 + 8 }}>
                  {pts.map((p, i) => (
                    <button
                      key={p.query}
                      onMouseEnter={() => setHover({ kind: k, ...p })}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover({ kind: k, ...p })}
                      onBlur={() => setHover(null)}
                      aria-label={`${p.query}: ${p.top.toFixed(3)}`}
                      className="absolute w-4 h-4 -ml-2 flex items-center justify-center transition-[left] duration-700"
                      style={{ left: inView ? x(p.top) : x(MIN), bottom: 4 + p.lane * 14, transitionDelay: `${i * 30}ms` }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full ring-2 ring-warmWhite" style={{ background: COLORS[k] }} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Floor */}
          <div className="absolute top-0 bottom-6 w-0.5 bg-charcoal pointer-events-none" style={{ left: `calc(${x(floor)})` }} aria-hidden="true" />
          <div className="relative h-6 font-mono text-[10px] text-olive">
            {[0.58, 0.62, 0.66, 0.7].map(t => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: x(t) }}>{t.toFixed(2)}</span>
            ))}
            <span className="absolute -translate-x-1/2 -top-1 px-1 bg-charcoal text-warmWhite font-bold" style={{ left: x(floor) }}>floor {floor}</span>
          </div>

          {hover && (
            <div className="absolute -top-2 right-0 bg-charcoal text-warmWhite text-xs px-2 py-1 pointer-events-none">
              “{hover.query}” · <span className="font-mono">{hover.top.toFixed(3)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Calibration;
