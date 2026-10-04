import React from 'react';
import type { Moment, PropertyMatch } from '../types';
import { formatPrice, formatTime, ROOM_LABELS } from '../lib/format';
import Highlight from './Highlight';
import { IconPlay } from './ui/Icons';

export interface SignalScale {
  visual: number; // highest visual cosine in this response
  speech: number;
}

interface MatchCardProps {
  match: PropertyMatch;
  rank: number;
  terms: string[];
  scale: SignalScale;
  hybrid: boolean;
  onOpen: (moment?: Moment) => void;
}

const Bar: React.FC<{ label: string; value: number; max: number }> = ({ label, value, max }) => {
  // Cosine scores for text-to-video sit in a narrow band, so scale relative to the best in the response.
  const floor = 0.1;
  const pct = max > floor ? Math.max(0, Math.min(1, (value - floor) / (max - floor))) : 0;
  return (
    <div className="flex items-center gap-2" title={`${label}: ${value.toFixed(2)}`}>
      <span className="w-11 text-[10px] font-mono uppercase tracking-wider text-olive">{label}</span>
      <span className="flex-1 h-1.5 bg-sand border border-charcoal/20">
        <span className="block h-full bg-charcoal" style={{ width: `${Math.round(pct * 100)}%` }} />
      </span>
    </div>
  );
};

const MomentTile: React.FC<{
  moment: Moment;
  fallbackImage: string;
  terms: string[];
  scale: SignalScale;
  hybrid: boolean;
  onClick: () => void;
}> = ({ moment, fallbackImage, terms, scale, hybrid, onClick }) => (
  <button
    onClick={e => {
      e.stopPropagation();
      onClick();
    }}
    className="group/m text-left bg-warmWhite border-2 border-charcoal hover:shadow-neobrutal-hover hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta flex flex-col min-w-0"
  >
    <div className="relative aspect-video bg-sand overflow-hidden border-b-2 border-charcoal">
      <img src={moment.frame || fallbackImage} alt="" loading="lazy" className="w-full h-full object-cover" />
      <span className="absolute left-1.5 top-1.5 bg-charcoal text-warmWhite text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase">
        {ROOM_LABELS[moment.room]}
      </span>
      <span className="absolute right-1.5 bottom-1.5 bg-terracotta text-white text-[11px] font-mono font-bold px-1.5 py-0.5 border border-charcoal">
        {formatTime(moment.start)}
      </span>
      <span className="absolute inset-0 flex items-center justify-center bg-charcoal/30 opacity-0 group-hover/m:opacity-100 transition-opacity">
        <IconPlay className="w-8 h-8 text-white" />
      </span>
    </div>
    <div className="p-3 flex flex-col gap-2 flex-1">
      <p className="text-sm text-charcoal leading-snug line-clamp-3">
        <Highlight text={moment.caption || 'Scene from the tour'} terms={terms} />
      </p>
      {moment.transcript && (
        <p className="text-xs text-olive italic leading-snug line-clamp-2">
          “<Highlight text={moment.transcript} terms={terms} />”
        </p>
      )}
      <div className="mt-auto pt-1 flex flex-col gap-1">
        {hybrid ? (
          <>
            <Bar label="Seen" value={moment.signals.visual} max={scale.visual} />
            <Bar label="Heard" value={moment.signals.speech} max={scale.speech} />
          </>
        ) : (
          <Bar label="Words" value={moment.signals.keyword} max={1} />
        )}
      </div>
    </div>
  </button>
);

const MatchCard: React.FC<MatchCardProps> = ({ match, rank, terms, scale, hybrid, onOpen }) => {
  const p = match.property;
  const facts = [
    p.beds ? `${p.beds} bd` : null,
    p.baths ? `${p.baths} ba` : null,
    p.sqft ? `${p.sqft.toLocaleString()} sq ft` : null,
    formatPrice(p.priceValue) || null,
  ].filter(Boolean);

  return (
    <article
      onClick={() => onOpen(match.moments[0])}
      className="bg-warmWhite border-2 border-charcoal shadow-neobrutal p-4 md:p-5 cursor-pointer hover:shadow-neobrutal-hover transition-shadow"
    >
      <header className="flex items-start gap-4 mb-4">
        <span className="shrink-0 w-9 h-9 bg-charcoal text-warmWhite font-mono font-bold flex items-center justify-center">
          {rank}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-xl text-charcoal uppercase tracking-tight leading-tight truncate">{p.name}</h3>
          <p className="text-xs font-mono text-olive uppercase tracking-wide truncate">
            {p.address}
            {facts.length > 0 && <span className="text-charcoal/40"> · </span>}
            {facts.join(' · ')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono font-bold text-terracotta">{match.moments.length}</div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-olive">{match.moments.length === 1 ? 'moment' : 'moments'}</div>
        </div>
      </header>

      {match.moments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {match.moments.map(m => (
            <MomentTile
              key={m.segmentId}
              moment={m}
              fallbackImage={p.thumbnailUrl}
              terms={terms}
              scale={scale}
              hybrid={hybrid}
              onClick={() => onOpen(m)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-olive">{p.description}</p>
      )}
    </article>
  );
};

export default MatchCard;
