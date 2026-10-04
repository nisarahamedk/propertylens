import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Chapter, Moment, Segment } from '../types';
import { formatTime, ROOM_LABELS, ROOM_ZONE, ZONE_STYLE, type Zone } from '../lib/format';

/** Fallback for tours indexed before chapters existed: merges 30s windows of the same room. */
export function toChapters(segments: Segment[], duration: number): Chapter[] {
  const chapters: Chapter[] = [];
  segments.forEach((s, i) => {
    const next = segments[i + 1];
    const end = next ? (s.end + next.start) / 2 : Math.max(s.end, duration);
    const start = chapters.length ? chapters[chapters.length - 1].end : 0;
    const last = chapters[chapters.length - 1];
    if (last && last.room === s.room) last.end = end;
    else chapters.push({ room: s.room, start, end, label: ROOM_LABELS[s.room] });
  });
  return chapters;
}

interface Props {
  chapters?: Chapter[];
  segments: Segment[];
  duration: number;
  currentTime: number;
  matches?: Moment[];
  onSeek: (t: number) => void;
}

const ChapterTimeline: React.FC<Props> = ({ chapters: timed, segments, duration, currentTime, matches = [], onSeek }) => {
  const chapters = useMemo(() => (timed?.length ? timed : toChapters(segments, duration)), [timed, segments, duration]);
  const current = chapters.find(c => currentTime >= c.start && currentTime < c.end) ?? chapters[chapters.length - 1];
  const zones = useMemo(() => [...new Set(chapters.map(c => ROOM_ZONE[c.room]))] as Zone[], [chapters]);
  const currentIndex = current ? chapters.indexOf(current) : -1;

  // Bar width, so a chapter only prints its label when the label fits.
  const barRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState(0);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBarWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the current chapter chip in view, scrolling only the chip row.
  const chipsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.children[currentIndex] as HTMLElement | undefined;
    if (!row || !chip) return;
    const left = chip.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: left - 12, behavior: 'smooth' });
    }
  }, [currentIndex]);

  if (!chapters.length || !duration) return null;
  const fits = (c: Chapter) => ((c.end - c.start) / duration) * barWidth >= c.label.length * 6.5 + 10;
  const pct = (t: number) => `${Math.min(100, (t / duration) * 100)}%`;

  return (
    <div className="bg-warmWhite border-2 border-t-0 border-charcoal px-3 pt-5 pb-3">
      <div className="relative h-8">
        {/* Search matches sit above the bar */}
        {matches.map(m => (
          <button
            key={m.segmentId}
            onClick={() => onSeek(m.start)}
            className="absolute -top-4 -translate-x-1/2 text-terracotta hover:scale-125 transition-transform"
            style={{ left: pct(m.start + Math.min(5, (m.end - m.start) / 2)) }}
            title={`Search match at ${formatTime(m.start)}`}
            aria-label={`Jump to search match at ${formatTime(m.start)}`}
          >
            <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden="true"><path d="M0 0h12L6 10z" fill="currentColor" /></svg>
          </button>
        ))}
        <div ref={barRef} className="absolute inset-0 flex border-2 border-charcoal overflow-hidden">
          {chapters.map((c, i) => {
            const z = ZONE_STYLE[ROOM_ZONE[c.room]];
            return (
              <button
                key={i}
                onClick={() => onSeek(c.start)}
                className={`${z.bg} ${z.text} h-full border-r border-charcoal/40 last:border-r-0 text-[10px] font-mono font-bold uppercase overflow-hidden whitespace-nowrap px-1 hover:brightness-110`}
                style={{ width: pct(c.end - c.start) }}
                title={`${c.label} · ${formatTime(c.start)}`}
                aria-label={`Jump to ${c.label} at ${formatTime(c.start)}`}
              >
                {fits(c) ? c.label : null}
              </button>
            );
          })}
        </div>
        <div
          className="absolute -top-1 -bottom-1 w-0.5 bg-charcoal pointer-events-none transition-[left] duration-200"
          style={{ left: pct(currentTime) }}
          aria-hidden="true"
        />
      </div>
      {/* Every chapter by name: short chapters are only colour in the bar, and on a phone most are short. */}
      <div
        ref={chipsRef}
        className="mt-3 -mx-3 px-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Rooms in this tour"
      >
        {chapters.map((c, i) => {
          const active = i === currentIndex;
          return (
            <button
              key={i}
              role="listitem"
              onClick={() => onSeek(c.start)}
              aria-current={active ? 'true' : undefined}
              className={`shrink-0 flex items-center gap-1.5 px-2 py-1 border-2 text-[11px] font-mono whitespace-nowrap transition-colors ${
                active ? 'bg-charcoal border-charcoal text-warmWhite' : 'bg-warmWhite border-charcoal/20 text-charcoal hover:border-charcoal'
              }`}
            >
              <span className={`w-2 h-2 border border-charcoal ${ZONE_STYLE[ROOM_ZONE[c.room]].bg}`} aria-hidden="true" />
              <span className="font-bold">{c.label}</span>
              <span className={active ? 'text-warmWhite/70' : 'text-olive'}>{formatTime(c.start)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono uppercase tracking-wider text-olive">
        {zones.map(z => (
          <span key={z} className="hidden sm:flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 border border-charcoal ${ZONE_STYLE[z].bg}`} />
            {ZONE_STYLE[z].label}
          </span>
        ))}
        {matches.length > 0 && (
          <span className="flex items-center gap-1.5 text-terracotta">
            <svg width="10" height="8" viewBox="0 0 12 10" aria-hidden="true"><path d="M0 0h12L6 10z" fill="currentColor" /></svg>
            Matches your search
          </span>
        )}
        <span className="ml-auto tabular-nums">{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>
    </div>
  );
};

export default ChapterTimeline;
