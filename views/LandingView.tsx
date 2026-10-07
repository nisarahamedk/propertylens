
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import PropertyThumbnail from '../components/PropertyThumbnail';
import { properties } from '../services/api';
import type { Property } from '../types';

const SUGGESTIONS = [
  // Each checked against the index: clear matches, not the closest-moments fallback.
  '3 bed in Surrey with a fenced backyard',
  'Soaker tub in the ensuite',
  'Under $1M condo with city views',
  'Close to SkyTrain',
];

const LandingView: React.FC = () => {
  const navigate = useNavigate();
  const featured = properties.slice(0, 8);

  const onSearch = (query: string) => navigate(`/search?q=${encodeURIComponent(query)}`);
  const onPropertyClick = (property: Property) => navigate(`/property/${property.id}`);

  return (
    <div className="min-h-screen flex flex-col bg-cream selection:bg-terracotta selection:text-white">
      <header className="w-full border-b-2 border-charcoal">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center gap-3">
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-8 h-8 md:w-9 md:h-9 bg-terracotta border-2 border-charcoal flex items-center justify-center">
              <div className="w-3 h-3 bg-warmWhite rounded-full border-2 border-charcoal" />
            </div>
            <span className="font-display text-lg md:text-xl text-charcoal tracking-tight font-bold">PropertyLens</span>
          </div>
          <Link to="/index" className="text-[10px] md:text-xs font-mono font-bold text-charcoal hover:text-terracotta uppercase tracking-widest border-b-2 border-charcoal hover:border-terracotta pb-0.5">
            <span className="md:hidden">Browse</span>
            <span className="hidden md:inline">Browse all tours</span>
          </Link>
          <Link to="/about" className="hidden md:inline ml-5 text-xs font-mono font-bold text-charcoal hover:text-terracotta uppercase tracking-widest border-b-2 border-charcoal hover:border-terracotta pb-0.5">
            How it works
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 w-full">
        <div className="pt-8 pb-8 md:pt-16 md:pb-12 max-w-4xl animate-fade-in">
          <h1 className="font-display text-[33px] leading-[1.02] md:text-6xl md:leading-none text-charcoal tracking-tight font-bold [text-wrap:balance]">
            Describe the home.{' '}
            <span className="block text-terracotta">We’ll show you the moment.</span>
          </h1>
          <p className="text-olive text-[15px] md:text-lg mt-3 md:mt-4 max-w-2xl leading-relaxed">
            Search inside {properties.length} home tour videos. Every result jumps to the room that matches.
          </p>

          <div className="mt-6 md:mt-8 relative z-10 max-w-2xl">
            <SearchBar onSearch={onSearch} placeholder={`Search ${properties.length} home tours…`} autoFocus />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="w-full md:w-auto md:mr-1 font-mono text-[10px] font-bold uppercase tracking-widest text-olive">Try</span>
            {SUGGESTIONS.map(suggestion => (
              <button
                key={suggestion}
                onClick={() => onSearch(suggestion)}
                className="px-3 py-1.5 bg-warmWhite border-2 border-charcoal text-charcoal font-mono font-bold text-[10px] md:text-[11px] uppercase hover:bg-terracotta hover:text-white transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t-2 border-charcoal pt-5 md:pt-8 pb-16">
          <div className="flex justify-between items-baseline mb-4 md:mb-6">
            <h2 className="font-display text-xl md:text-3xl text-charcoal font-bold">Featured tours</h2>
            <Link to="/index" className="text-charcoal hover:text-terracotta text-[10px] md:text-xs font-mono font-bold tracking-widest uppercase border-b-2 border-charcoal hover:border-terracotta pb-0.5">
              All {properties.length} tours →
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 md:gap-x-6 gap-y-6 md:gap-y-10">
            {featured.map(property => (
              <PropertyThumbnail key={property.id} property={property} onClick={() => onPropertyClick(property)} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingView;
