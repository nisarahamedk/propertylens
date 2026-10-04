import React, { useMemo } from 'react';
import type { Moment, Segment } from '../types';
import { formatTime, ROOM_LABELS, ROOM_ZONE, ZONE_STYLE, type Zone } from '../lib/format';

interface Chapter {
  room: Segment['room'];
  start: number;
  end: number;
}

/** Merges consecutive windows of the same room into chapters, cutting overlaps at the midpoint. */
export function toChapters(segments: Segment[], duration: number): Chapter[] {
  const chapters: Chapter[] = [];
  segments.forEach((s, i) => {
    const next = segments[i + 1];
    const end = next ? (s.end + next.start) / 2 : Math.max(s.end, duration);
    const start = chapters.length ? chapters[chapters.length - 1].end : 0;
    const last = chapters[chapters.length - 1];
    if (last && last.room === s.room) last.end = end;
    else chapters.push({ room: s.room, start, end });
  });
  return chapters;
}

interface Props {
  segments: Segment[];
  duration: number;
  currentTime: number;
  matches?: Moment[];
  onSeek: (t: number) => void;
}

const ChapterTimeline: React.FC<Props> = ({ segments, duration, currentTime, matches = [], onSeek }) => {
  const chapters = useMemo(() => toChapters(segments, duration), [segments, duration]);
  const zones = useMemo(() => [...new Set(chapters.map(c => ROOM_ZONE[c.room]))] as Zone[], [chapters]);
  if (!chapters.length || !duration) return null;
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
        <div className="absolute inset-0 flex border-2 border-charcoal overflow-hidden">
          {chapters.map((c, i) => {
            const z = ZONE_STYLE[ROOM_ZONE[c.room]];
            return (
              <button
                key={i}
                onClick={() => onSeek(c.start)}
                className={`${z.bg} ${z.text} h-full border-r border-charcoal/40 last:border-r-0 text-[10px] font-mono font-bold uppercase overflow-hidden whitespace-nowrap px-1 hover:brightness-110`}
                style={{ width: pct(c.end - c.start) }}
                title={`${ROOM_LABELS[c.room]} · ${formatTime(c.start)}`}
              >
                {ROOM_LABELS[c.room]}
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
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono uppercase tracking-wider text-olive">
        {zones.map(z => (
          <span key={z} className="flex items-center gap-1.5">
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
