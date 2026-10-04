
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import PropertyThumbnail from '../components/PropertyThumbnail';
import { properties, totalScenes } from '../services/api';
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
  const minutes = Math.round(properties.reduce((n, p) => n + p.duration, 0) / 60);

  const onSearch = (query: string) => navigate(`/search?q=${encodeURIComponent(query)}`);
  const onPropertyClick = (property: Property) => navigate(`/property/${property.id}`);

  return (
    <div className="min-h-screen flex flex-col bg-cream selection:bg-terracotta selection:text-white">
      {/* Header */}
      <header className="w-full px-6 py-8 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-3 group cursor-pointer">
           {/* Geometric Lens Logo */}
           <div className="w-10 h-10 bg-terracotta border-2 border-charcoal shadow-neobrutal-sm flex items-center justify-center transition-all duration-200 group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px]">
              <div className="w-4 h-4 bg-warmWhite rounded-full border-2 border-charcoal"></div>
           </div>
           <span className="font-display text-2xl text-charcoal tracking-tight font-bold">PropertyLens</span>
        </div>
        <Link to="/about" className="text-xs font-mono font-bold text-charcoal hover:text-terracotta transition-colors uppercase tracking-widest border-b-2 border-charcoal hover:border-terracotta pb-0.5">How it works</Link>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 w-full">
        {/* Hero Section */}
        <div className="py-10 md:py-16 text-center max-w-4xl mx-auto animate-fade-in">
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-charcoal mb-4 leading-[0.9] tracking-tight font-bold">
            FIND YOUR DREAM HOME
            <span className="text-terracotta font-medium ml-2 decoration-clone italic">by describing what you want to see.</span>
          </h1>

          <p className="text-olive text-sm md:text-base mb-8 max-w-xl mx-auto font-sans leading-relaxed font-medium">
            Search inside {properties.length} home tour videos by what you want to see or hear, then jump straight to that moment.
          </p>

          <div className="max-w-2xl mx-auto mb-8 relative z-10">
            <SearchBar
              onSearch={onSearch}
              placeholder={`Search ${properties.length} home tours…`}
              className="transform transition-transform duration-300"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {SUGGESTIONS.map((suggestion, idx) => (
              <button
                key={suggestion}
                onClick={() => onSearch(suggestion)}
                className="px-4 py-2 rounded-none bg-warmWhite border-2 border-charcoal text-charcoal font-mono font-bold hover:bg-terracotta hover:text-white hover:shadow-neobrutal-sm hover:-translate-y-0.5 transition-all duration-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-xs uppercase tracking-tight shadow-[2px_2px_0_0_rgba(26,38,27,0.1)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Properties Grid */}
        <div className="border-t-2 border-charcoal pt-16 pb-20">
          <div className="flex justify-between items-end mb-10">
            <h2 className="font-display text-4xl text-charcoal flex items-center gap-3 font-bold">
              <span className="w-4 h-4 bg-terracotta rounded-none border-2 border-charcoal"></span>
              In the index
            </h2>
            <p className="hidden lg:block font-mono text-xs uppercase tracking-widest text-olive">
              {properties.length} tours · {minutes} min of video{totalScenes ? ` · ${totalScenes} scenes` : ''}
            </p>
            <button
              onClick={() => navigate('/index')}
              className="hidden md:block text-charcoal hover:text-terracotta text-xs font-mono font-bold tracking-widest uppercase transition-colors border-b-2 border-charcoal hover:border-terracotta pb-1"
            >
              Browse all tours
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
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
