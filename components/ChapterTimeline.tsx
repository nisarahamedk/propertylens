import React from 'react';
import type { Chapter, Moment, Segment } from '../types';
import { formatTime, ROOM_LABELS, ROOM_ZONE, ZONE_STYLE } from '../lib/format';

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
  chapters: Chapter[];
  duration: number;
  currentTime: number;
  matches?: Moment[];
  onSeek: (t: number) => void;
}

/** One thin bar of the tour's rooms, coloured by zone, with the playhead and search matches. */
const ChapterTimeline: React.FC<Props> = ({ chapters, duration, currentTime, matches = [], onSeek }) => {
  if (!chapters.length || !duration) return null;
  const pct = (t: number) => `${Math.min(100, (t / duration) * 100)}%`;

  return (
    <div className="relative h-5 bg-cream" aria-label="Rooms in this tour">
      <div className="absolute inset-x-0 top-0 h-full flex">
        {chapters.map((c, i) => (
          <button
            key={i}
            onClick={() => onSeek(c.start)}
            className="group h-full flex flex-col"
            style={{ width: pct(c.end - c.start) }}
            title={`${c.label} · ${formatTime(c.start)}`}
            aria-label={`Jump to ${c.label} at ${formatTime(c.start)}`}
          >
            <span className={`block h-1.5 w-full ${ZONE_STYLE[ROOM_ZONE[c.room]].bg} group-hover:brightness-110`} />
          </button>
        ))}
      </div>
      {matches.map(m => (
        <button
          key={m.segmentId}
          onClick={() => onSeek(m.start)}
          className="absolute top-2 -translate-x-1/2 text-terracotta hover:scale-125 transition-transform"
          style={{ left: pct(m.start + Math.min(5, (m.end - m.start) / 2)) }}
          title={`Search match at ${formatTime(m.start)}`}
          aria-label={`Jump to search match at ${formatTime(m.start)}`}
        >
          <svg width="10" height="8" viewBox="0 0 12 10" aria-hidden="true"><path d="M6 0l6 10H0z" fill="currentColor" /></svg>
        </button>
      ))}
      <div
        className="absolute -top-1 h-3.5 w-[3px] bg-charcoal ring-1 ring-warmWhite pointer-events-none transition-[left] duration-200"
        style={{ left: pct(currentTime) }}
        aria-hidden="true"
      />
    </div>
  );
};

export default ChapterTimeline;
