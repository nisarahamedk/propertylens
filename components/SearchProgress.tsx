import React, { useEffect, useMemo, useState } from 'react';
import { formatTime } from '../lib/format';
import { properties, totalScenes } from '../services/api';

// Every room still in the catalog: the same pictures the search compares against.
const STILLS = properties.flatMap(p => (p.chapters ?? []).filter(c => c.frame && c.room !== 'other').map(c => c.frame!));

const TILES = 12;
// The model checks up to this many of the best homes (server/verify.ts).
const CHECKED = 8;

// The search answers in one response, so the steps follow its usual pace:
// reading, embedding and ranking take about a second, checking the best homes
// with the multimodal model takes the rest. Early steps are paced so they can be read.
const STEP_ENDS = [900, 2400, 3600];

const pick = <T,>(list: T[], n: number): T[] => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** What the search is doing while it runs: a wall of room stills being scanned, then the best homes being checked. */
const SearchProgress: React.FC<{ query: string }> = ({ query }) => {
  const [elapsed, setElapsed] = useState(0);
  const [tiles, setTiles] = useState(() => pick(STILLS, TILES));
  const still = useMemo(reducedMotion, []);

  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => setElapsed(performance.now() - t0), 100);
    return () => clearInterval(id);
  }, []);

  const step = STEP_ENDS.findIndex(end => elapsed < end);
  const current = step === -1 ? STEP_ENDS.length : step;
  const checking = current === STEP_ENDS.length;

  // While scanning, keep swapping stills in so the wall feels like it is flipping through the index.
  useEffect(() => {
    if (still || checking) return;
    const id = setInterval(() => {
      setTiles(prev => {
        const next = [...prev];
        next[Math.floor(Math.random() * TILES)] = STILLS[Math.floor(Math.random() * STILLS.length)];
        return next;
      });
    }, 220);
    return () => clearInterval(id);
  }, [still, checking]);

  const shortlist = useMemo(() => pick([...Array(TILES).keys()], CHECKED), []);
  const focus = checking ? shortlist[Math.floor((elapsed - STEP_ENDS[2]) / 1400) % CHECKED] : -1;

  const progress = (from: number, to: number) => Math.min(1, Math.max(0, (elapsed - from) / (to - from)));
  const scenes = Math.round(totalScenes * progress(STEP_ENDS[0], STEP_ENDS[1]));
  const stills = Math.round(STILLS.length * progress(STEP_ENDS[1], STEP_ENDS[2]));
  // Most searches finish in 15 to 30 seconds; the bar slows as it nears the end and never claims to be done.
  const bar = 0.95 * (1 - Math.exp(-elapsed / 9000));

  const steps = [
    { title: 'Reading your search', detail: 'Separating listing facts from what to look for' },
    {
      title: `Scanning ${totalScenes} scenes`,
      detail: `${scenes} of ${totalScenes} scenes from ${properties.length} tours`,
    },
    { title: `Comparing ${STILLS.length} room stills`, detail: `${stills} of ${STILLS.length} pictures of rooms` },
    {
      title: 'Checking the best homes',
      detail: 'A multimodal model watches each scene and reads what the agent says. This takes 15 to 30 seconds.',
    },
  ];

  return (
    <div className="bg-warmWhite border-2 border-charcoal shadow-neobrutal" aria-busy="true" aria-live="polite">
      <div className="flex flex-col md:flex-row">
        <div className="relative md:w-[420px] lg:w-[480px] shrink-0 border-b-2 md:border-b-0 md:border-r-2 border-charcoal overflow-hidden bg-charcoal">
          <div className="grid grid-cols-4 gap-px md:absolute md:inset-0 md:grid-rows-3" aria-hidden="true">
            {tiles.map((src, i) => {
              const out = checking && !shortlist.includes(i);
              return (
                <div key={i} className="relative aspect-[4/3] md:aspect-auto bg-sand overflow-hidden">
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className={`w-full h-full object-cover transition-all duration-500 ${still ? '' : 'animate-fade-in'} ${
                      out ? 'opacity-25 grayscale' : ''
                    }`}
                  />
                  {i === focus && (
                    <span className="absolute inset-0 border-[3px] border-terracotta shadow-[inset_0_0_0_2px_#1A261B] motion-safe:animate-fade-in" />
                  )}
                </div>
              );
            })}
          </div>
          {!checking && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 motion-safe:animate-scan bg-gradient-to-r from-transparent via-terracotta/25 to-terracotta/0 border-r-2 border-terracotta"
            />
          )}
          <span className="absolute left-2 bottom-2 bg-charcoal text-warmWhite font-mono text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5">
            {checking ? 'Checking the best homes' : 'Scanning the tours'}
          </span>
        </div>

        <div className="flex-1 min-w-0 p-4 md:p-6 flex flex-col">
          <p className="font-mono text-[10px] md:text-xs uppercase tracking-widest text-olive">Searching the tours for</p>
          <p className="font-display text-xl md:text-2xl font-bold text-charcoal leading-tight mt-1 break-words">“{query}”</p>

          <ol className="mt-4 md:mt-5 space-y-3">
            {steps.map((s, i) => {
              const done = i < current;
              const active = i === current;
              return (
                <li key={s.title} className={`flex gap-3 ${!done && !active ? 'opacity-40' : ''}`}>
                  <span className="mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center border-2 border-charcoal bg-warmWhite">
                    {done ? (
                      <span className="text-[#2F6B3A] font-bold text-sm leading-none">✓</span>
                    ) : active ? (
                      <span className="w-2 h-2 bg-terracotta motion-safe:animate-pulse" />
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-sm md:text-base text-charcoal ${active ? 'font-semibold' : ''}`}>{s.title}</p>
                    {(active || (done && i > 0)) && (
                      <p className="font-mono text-[11px] md:text-xs text-olive mt-0.5">
                        {s.detail}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 md:mt-auto pt-2 flex items-center gap-3">
            <div className="flex-1 h-2 border-2 border-charcoal bg-sand overflow-hidden">
              <div className="h-full bg-terracotta transition-[width] duration-300 ease-out" style={{ width: `${bar * 100}%` }} />
            </div>
            <span className="font-mono text-xs font-bold text-charcoal tabular-nums">{formatTime(elapsed / 1000)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchProgress;
