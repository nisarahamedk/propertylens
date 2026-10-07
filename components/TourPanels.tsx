import React from 'react';
import type { Chapter, Moment, Property } from '../types';
import { formatTime } from '../lib/format';
import { capitalize, checkHome, evidenceFor, stem, tourPlaces, type SearchPart } from '../lib/match';
import CheckMark from './CheckMark';
import Highlight from './Highlight';

/** The chapter a search moment points at: the one with its label nearest in time, else the one it starts in. */
function chapterFor(m: Moment, chapters: Chapter[]): Chapter | undefined {
  const named = chapters.filter(c => c.label === m.label);
  if (named.length) return named.reduce((a, b) => (Math.abs(b.start - m.start) < Math.abs(a.start - m.start) ? b : a));
  return chapters.find(c => m.start >= c.start && m.start < c.end);
}

interface SearchPanelProps {
  property: Property;
  parts: SearchPart[];
  semantic: string;
  moments: Moment[];
  currentTime: number;
  onSeek: (t: number) => void;
  next?: { title: string; onClick: () => void };
}

/** "Your search": each part of the search, ticked off against this home, with the proof. */
export const SearchPanel: React.FC<SearchPanelProps> = ({ property, parts, semantic, moments, currentTime, onSeek, next }) => {
  const evidence = evidenceFor(moments, semantic);
  const checks = checkHome(property, parts, evidence);
  const m = evidence?.moment;
  const playing = m && currentTime >= m.start && currentTime < m.end;
  const others = moments.filter(o => o !== m);
  const terms = evidence ? evidence.found.map(stem) : [];

  return (
    <div className="grid gap-2">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-olive mb-0.5">How this home matches</p>
      {checks.map(c =>
        c.part.source === 'listing' ? (
          <div key={c.part.label} className="flex items-center gap-3 px-3 py-2.5 bg-warmWhite border-2 border-charcoal/15">
            <CheckMark status={c.status} />
            <div>
              <p className="font-semibold text-sm">{c.part.label}</p>
              <p className="text-[12.5px] text-olive">{c.detail}, from the listing</p>
            </div>
          </div>
        ) : (
          <div key={c.part.label} className="px-3 py-2.5 bg-warmWhite border-2 border-terracotta">
            <div className="flex items-center gap-3">
              <CheckMark status={c.status} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{capitalize(c.part.label)}</p>
                <p className="text-[12.5px] text-olive">{c.detail}</p>
              </div>
              {m && (
                <button
                  onClick={() => onSeek(m.start)}
                  className="shrink-0 bg-terracotta text-white font-mono text-[10px] font-bold uppercase px-2 py-1 border-2 border-charcoal hover:bg-charcoal"
                >
                  {playing ? '▶ Playing' : `▶ Play ${formatTime(m.start)}`}
                </button>
              )}
            </div>
            {m && (
              <div className="mt-2 pt-2 border-t-[1.5px] border-sand text-[13px] leading-snug">
                <p><Highlight text={m.caption} terms={terms} /></p>
                {evidence!.quote && (
                  <p className="mt-1 italic text-olive">“<Highlight text={evidence!.quote} terms={terms} />”</p>
                )}
              </div>
            )}
            {others.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-olive">
                Also at
                {others.map(o => (
                  <button
                    key={o.segmentId}
                    onClick={() => onSeek(o.start)}
                    className="font-mono text-[11px] font-bold border-b border-charcoal text-charcoal hover:text-terracotta"
                  >
                    {formatTime(o.start)}{o.label ? ` ${o.label}` : ''}
                  </button>
                ))}
              </p>
            )}
          </div>
        ),
      )}
      {next && (
        <button
          onClick={next.onClick}
          className="mt-2 self-start text-left font-mono text-[11px] font-bold uppercase tracking-widest text-terracotta hover:text-charcoal"
        >
          Next home: {next.title} ›
        </button>
      )}
    </div>
  );
};

interface RoomsPanelProps {
  chapters: Chapter[];
  currentTime: number;
  matches: Moment[];
  fallbackImage: string;
  onSeek: (t: number) => void;
}

/** Each place in the tour once, as a photo with when it is first shown; the one playing is outlined. */
export const RoomsPanel: React.FC<RoomsPanelProps> = ({ chapters, currentTime, matches, fallbackImage, onSeek }) => {
  const shown = tourPlaces(chapters);
  const label = (c?: Chapter) => c?.label.toLowerCase();
  const matched = new Set(matches.map(m => label(chapterFor(m, chapters))).filter(Boolean));
  const playing = label(chapters.find(c => currentTime >= c.start && currentTime < c.end));
  if (!shown.length) {
    return <p className="text-sm text-olive font-mono">Rooms appear here once this tour has been indexed.</p>;
  }
  return (
    <ol className="grid grid-cols-2 gap-x-2.5 gap-y-3">
      {shown.map((c, i) => {
        const on = label(c) === playing;
        return (
          <li key={i}>
            <button onClick={() => onSeek(c.start)} className="group w-full text-left" aria-current={on ? 'true' : undefined}>
              <span className="relative block">
                <img
                  src={c.frame || fallbackImage}
                  alt=""
                  loading="lazy"
                  className={`w-full aspect-video object-cover border-[1.5px] border-charcoal group-hover:brightness-105 ${
                    on ? 'outline outline-[3px] -outline-offset-1 outline-terracotta' : ''
                  }`}
                />
                {matched.has(label(c)) && (
                  <span className="absolute left-1.5 top-1.5 bg-terracotta text-white font-mono text-[9px] font-bold uppercase px-1.5 py-0.5">
                    Match
                  </span>
                )}
              </span>
              <span className={`mt-1 flex justify-between gap-2 text-[12.5px] ${on ? 'font-semibold' : ''}`}>
                <span className="truncate">{c.label}</span>
                <span className="font-mono text-[10px] text-olive">{formatTime(c.start)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
};
