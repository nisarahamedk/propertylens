import React, { useEffect, useRef } from 'react';
import type { Segment } from '../types';
import { formatTime, ROOM_LABELS } from '../lib/format';
import Highlight from './Highlight';

interface Props {
  segments: Segment[];
  currentTime: number;
  matchedIds: Set<string>;
  terms: string[];
  fallbackImage: string;
  onSeek: (t: number) => void;
}

const ScenePanel: React.FC<Props> = ({ segments, currentTime, matchedIds, terms, fallbackImage, onSeek }) => {
  // The active scene is the latest window that has started; overlaps resolve to the newer one.
  const activeIndex = segments.reduce((acc, s, i) => (currentTime >= s.start ? i : acc), 0);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  if (!segments.length) {
    return (
      <p className="p-5 text-warmWhite/60 text-sm font-mono">
        Scene notes appear here once this tour has been indexed.
      </p>
    );
  }

  return (
    <ol ref={listRef} className="p-3 space-y-2">
      {segments.map((s, i) => {
        const active = i === activeIndex;
        const matched = matchedIds.has(s.id);
        return (
          <li key={s.id}>
            <button
              onClick={() => onSeek(s.start)}
              className={`w-full text-left flex gap-3 p-2 border-2 transition-colors ${
                active ? 'bg-warmWhite border-terracotta' : 'border-transparent hover:border-warmWhite/30'
              }`}
            >
              <img
                src={s.frame || fallbackImage}
                alt=""
                loading="lazy"
                className="w-24 aspect-video object-cover border border-charcoal shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className={`flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider ${active ? 'text-olive' : 'text-warmWhite/60'}`}>
                  {formatTime(s.start)} · {ROOM_LABELS[s.room]}
                  {matched && <span className="bg-terracotta text-white px-1">Match</span>}
                </span>
                <span className={`block text-sm leading-snug mt-0.5 line-clamp-3 ${active ? 'text-charcoal' : 'text-warmWhite/85'}`}>
                  <Highlight
                    text={s.caption}
                    terms={matched ? terms : []}
                    markClass={active ? 'bg-terracotta/20 text-charcoal' : 'bg-terracotta/50 text-warmWhite'}
                  />
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
};

export default ScenePanel;
