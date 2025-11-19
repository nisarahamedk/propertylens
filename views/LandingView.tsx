
import React, { useState, useEffect } from 'react';
import SearchBar from '../components/SearchBar';
import PropertyThumbnail from '../components/PropertyThumbnail';
import { getRecentProperties } from '../services/searchService';
import { Property } from '../types';
import { PropertyThumbnailSkeleton } from '../components/ui/Skeletons';

interface LandingViewProps {
  onSearch: (query: string) => void;
  onPropertyClick: (property: Property) => void;
}

const SUGGESTIONS = [
  "Modern kitchen with island",
  "Backyard with mature trees",
  "Natural light in living room",
  "Exposed brick walls"
];

const LandingView: React.FC<LandingViewProps> = ({ onSearch, onPropertyClick }) => {
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = async () => {
    setIsLoadingProperties(true);
    setError(null);
    try {
      const data = await getRecentProperties();
      setProperties(data);
    } catch (err: any) {
      console.error("Failed to load properties", err);
      setError(err.message || "Failed to connect to the property index.");
    } finally {
      setIsLoadingProperties(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

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
        <button className="text-xs font-mono font-bold text-charcoal hover:text-terracotta transition-colors uppercase tracking-widest border-b-2 border-charcoal hover:border-terracotta pb-0.5">About Project</button>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 w-full">
        {/* Hero Section */}
        <div className="py-20 md:py-32 text-center max-w-5xl mx-auto animate-fade-in">
          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-charcoal mb-8 leading-[0.9] tracking-tight font-bold">
            FIND YOUR SPACE <br/>
            <span className="text-terracotta font-medium block mt-2 decoration-clone italic">by describing what you see.</span>
          </h1>
          
          <p className="text-olive text-lg md:text-xl mb-14 max-w-2xl mx-auto font-sans leading-relaxed font-medium border-l-4 border-terracotta pl-6 text-left bg-sand/20 py-4">
            Search across our index of property videos using natural language that understands both visual features and spoken descriptions.
          </p>

          <div className="max-w-2xl mx-auto mb-12 relative z-10">
            <SearchBar 
              onSearch={onSearch} 
              placeholder="Search across 127 properties..." 
              className="transform transition-transform duration-300"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap justify-center gap-3 opacity-0 animate-slide-up" style={{ animationDelay: '0.2s' }}>
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
        <div className="border-t-2 border-charcoal pt-16 pb-20 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex justify-between items-end mb-10">
            <h2 className="font-display text-4xl text-charcoal flex items-center gap-3 font-bold">
              <span className="w-4 h-4 bg-terracotta rounded-none border-2 border-charcoal"></span>
              Recently Indexed
            </h2>
            <button className="hidden md:block text-charcoal hover:text-terracotta text-xs font-mono font-bold tracking-widest uppercase transition-colors border-b-2 border-charcoal hover:border-terracotta pb-1">View All Index</button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {error ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 border-2 border-charcoal bg-terracotta/5 text-center animate-fade-in">
                <div className="w-12 h-12 bg-terracotta text-white flex items-center justify-center rounded-full mb-4 shadow-neobrutal-sm border-2 border-charcoal">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                   </svg>
                </div>
                <h3 className="font-display text-xl font-bold text-charcoal uppercase tracking-tight mb-2">Connection Failed</h3>
                <p className="text-sm font-mono text-olive mb-6 max-w-md">{error}</p>
                <button 
                   onClick={fetchProperties}
                   className="px-6 py-2 bg-charcoal text-warmWhite font-mono text-xs font-bold uppercase tracking-widest hover:bg-terracotta transition-colors border-2 border-charcoal"
                >
                  Retry Connection
                </button>
              </div>
            ) : isLoadingProperties ? (
               Array.from({ length: 4 }).map((_, i) => (
                 <div key={i} className="animate-slide-up" style={{ animationDelay: `${0.5 + (i * 0.1)}s` }}>
                    <PropertyThumbnailSkeleton />
                 </div>
               ))
            ) : properties.length > 0 ? (
              properties.map((property, idx) => (
                <div key={property.id} className="animate-slide-up" style={{ animationDelay: `${0.5 + (idx * 0.1)}s` }}>
                  <PropertyThumbnail 
                    property={property} 
                    onClick={() => onPropertyClick(property)}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-16 border-2 border-dashed border-charcoal/20 bg-sand/10 rounded-none">
                <div className="w-12 h-12 mb-4 text-charcoal/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <p className="font-mono text-charcoal font-bold uppercase tracking-wide mb-1">Index Empty</p>
                <p className="text-sm text-olive font-sans">No properties found in Ragie index.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingView;
