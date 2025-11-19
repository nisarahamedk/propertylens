import React from 'react';
import { SearchResult } from '../types';
import { IconPlay, IconSparkles } from './ui/Icons';

interface ResultCardProps {
  result: SearchResult;
  onWatch: () => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, onWatch }) => {
  return (
    <div 
      className="group relative bg-warmWhite p-4 sm:p-6 border-2 border-charcoal shadow-neobrutal hover:shadow-neobrutal-hover hover:-translate-y-1 transition-all duration-200 cursor-pointer"
      onClick={onWatch}
    >
      <div className="flex flex-col md:flex-row gap-6">
        {/* Thumbnail Section */}
        <div className="relative shrink-0 w-full md:w-[300px] lg:w-[340px] aspect-video overflow-hidden border-2 border-charcoal bg-sand">
          <img 
            src={result.thumbnailUrl} 
            alt={`Match at ${result.timestamp}`} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 filter grayscale-[20%] group-hover:grayscale-0"
          />
          <div className="absolute top-0 left-0 bg-terracotta text-white text-xs font-mono font-bold px-2 py-1 border-b-2 border-r-2 border-charcoal">
            {result.timestamp}
          </div>
          
          <div className="absolute inset-0 bg-charcoal/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
             <div className="w-12 h-12 bg-warmWhite flex items-center justify-center text-charcoal border-2 border-charcoal shadow-neobrutal-sm hover:bg-charcoal hover:text-white transition-colors">
                <IconPlay className="w-5 h-5 ml-1" />
             </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <div className="w-full">
              <div className="flex justify-between items-start">
                <h3 className="text-charcoal font-display font-bold text-2xl leading-tight group-hover:text-terracotta transition-colors uppercase tracking-tight">
                  {result.property.name}
                </h3>
              </div>
              <span className="text-olive text-xs font-mono font-medium tracking-wide uppercase mt-1 block border-b border-charcoal/10 pb-2">{result.property.address}</span>
            </div>
          </div>
          
          <div className="relative my-3 pl-4 border-l-4 border-terracotta bg-sand/20 py-3 pr-2">
            <p className="text-charcoal font-sans text-lg font-medium leading-relaxed">
              "{result.transcriptSnippet}"
            </p>
          </div>
          
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
            <div className="flex items-center gap-2 text-olive">
              <IconSparkles className="w-4 h-4 text-terracotta" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-charcoal">
                Match:
              </span>
              <span className="text-xs text-charcoal font-mono border-b border-charcoal/20">
                {result.visualMatchReason}
              </span>
            </div>
            
            <div 
              className="hidden sm:flex items-center px-4 py-1.5 bg-charcoal text-warmWhite text-xs font-mono font-bold tracking-widest uppercase border-2 border-charcoal hover:bg-white hover:text-charcoal transition-colors"
            >
              Watch Scene
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultCard;