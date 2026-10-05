import React, { useEffect, useRef, useState } from 'react';
import snapshot from '../../data/explainer.json';
import type { Chapter, Room, SearchFilters } from '../../types';

// ---- Data captured by ingestion/explainer-snapshot.ts ----

export interface TraceRow {
  id: string;
  tour: string;
  name: string;
  start: number;
  room: Room;
  rooms?: string[];
  frame?: string;
  caption: string;
  visual: number;
  speech: number;
  keyword: number;
  allWords: boolean;
  ranks: [number | null, number | null, number | null]; // over all candidates; null = no score
}

export interface Trace {
  query: string;
  semantic: string;
  filters: SearchFilters;
  candidates: number;
  candidateTours: number;
  timings: Record<string, number>;
  results: { tour: string; name: string; label?: string; start?: number; frame?: string }[];
  shortlist: TraceRow[];
}

export interface Explainer {
  generatedAt: string;
  models: { embedding: string; flash: string; dims: number };
  settings: {
    segment: { length: number; step: number; minTail: number };
    ranking: {
      visualWeight: number;
      speechWeight: number;
      rrf: { k: number; visual: number; speech: number; keyword: number };
      minBlended: number;
      distinctiveDocShare: number;
      maxProperties: number;
    };
  };
  stats: { tours: number; scenes: number; chapters: number; vectors: number; minutes: number; vectorsMB: number };
  traces: Trace[];
  calibration: { absent: { query: string; top: number }[]; present: { query: string; top: number }[] };
  sample: {
    tour: { id: string; name: string; duration: number; chapters: Chapter[]; windows: { start: number; end: number }[] };
    scene: { id: string; start: number; end: number; room: Room; caption: string; features: string[]; transcript: string; frame?: string; rooms?: string[] };
    vectors: {
      query: string;
      queryHead: number[];
      visualHead: number[];
      speechHead: number[];
      cos: { visual: number; speech: number };
      contrast: { id: string; room: string; visual: number; speech: number };
    };
  };
}

export const data = snapshot as unknown as Explainer;

// ---- Scroll reveal ----

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends HTMLElement>(threshold = 0.25): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') return setSeen(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, threshold]);
  return [ref, seen];
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---- Layout ----

export const Section: React.FC<{ id: string; kicker: string; title: string; lede?: React.ReactNode; children: React.ReactNode }> = ({ id, kicker, title, lede, children }) => {
  const [ref, inView] = useInView<HTMLElement>(0.1);
  return (
    <section id={id} ref={ref} className={`reveal ${inView ? 'in' : ''} py-12 md:py-16 border-t-2 border-charcoal scroll-mt-20`}>
      <p className="font-mono text-xs uppercase tracking-widest text-terracotta mb-2">{kicker}</p>
      <h2 className="font-display text-3xl md:text-4xl font-bold text-charcoal leading-tight mb-4">{title}</h2>
      {lede && <div className="text-charcoal/80 text-base md:text-lg max-w-3xl mb-8 space-y-3">{lede}</div>}
      {children}
    </section>
  );
};

/** "In production" aside that sits under a demo explanation. */
export const ProdNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mt-6 border-2 border-charcoal bg-charcoal text-warmWhite p-4 text-sm leading-relaxed">
    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-terracotta mr-2">In production</span>
    {children}
  </div>
);

export const Code: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code className="font-mono text-[0.85em] bg-sand px-1 border border-charcoal/10">{children}</code>
);

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
