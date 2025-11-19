import React from 'react';
import { SearchResult } from '../types';
import { IconPlay } from './ui/Icons';

interface ResultCardProps {
  result: SearchResult;
  onWatch: () => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, onWatch }) => {
  return (
    <div
      className="group relative bg-warmWhite p-4 border-2 border-charcoal shadow-neobrutal hover:shadow-neobrutal-hover hover:-translate-y-1 transition-all duration-200 cursor-pointer"
      onClick={onWatch}
    >
      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        <div className="relative shrink-0 w-24 h-16 overflow-hidden border-2 border-charcoal bg-sand">
          <img
            src={result.thumbnailUrl}
            alt={result.property.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-charcoal/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <IconPlay className="w-4 h-4 text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-charcoal font-display font-bold text-lg leading-tight group-hover:text-terracotta transition-colors uppercase tracking-tight truncate">
            {result.property.name}
          </h3>
          <span className="text-olive text-xs font-mono tracking-wide uppercase">{result.property.address}</span>
        </div>

        {/* Relevance Score */}
        <div className="shrink-0 text-right">
          <div className="text-terracotta text-sm font-mono font-bold">
            {Math.round(result.score * 100)}%
          </div>
          <div className="text-olive/60 text-[10px] font-mono uppercase tracking-wider">
            Match
          </div>
        </div>

        {/* Duration */}
        <div className="shrink-0 bg-terracotta text-white text-xs font-mono font-bold px-3 py-1.5 border-2 border-charcoal">
          {result.duration}
        </div>
      </div>
    </div>
  );
};

export default ResultCard;