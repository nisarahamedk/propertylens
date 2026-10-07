import React from 'react';
import type { SearchPart } from '../lib/match';

/** The search split into what the listing confirms and what the video has to show. */
const SearchParts: React.FC<{ parts: SearchPart[]; intro?: string }> = ({ parts, intro }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {intro && <span className="mr-1 font-mono text-[10px] font-bold uppercase tracking-widest text-olive">{intro}</span>}
    {parts.map(p => (
      <span
        key={p.label}
        className={`inline-flex items-center gap-1.5 border-2 border-charcoal px-2.5 py-1 text-[13px] font-medium whitespace-nowrap ${
          p.source === 'video' ? 'bg-terracotta text-white' : 'bg-warmWhite text-charcoal'
        }`}
      >
        {p.label}
        <span className={`font-mono text-[9px] font-bold uppercase tracking-wider ${p.source === 'video' ? 'text-white/85' : 'text-olive'}`}>
          {p.source === 'video' ? 'in the video' : 'listing'}
        </span>
      </span>
    ))}
  </div>
);

export default SearchParts;
