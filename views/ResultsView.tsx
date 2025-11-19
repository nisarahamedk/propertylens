
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import ResultCard from '../components/ResultCard';
import { IconArrowLeft } from '../components/ui/Icons';
import { SearchResult } from '../types';
import { searchProperties } from '../services/searchService';
import { ResultCardSkeleton, SearchHeaderSkeleton } from '../components/ui/Skeletons';

const LOADING_MESSAGES = [
  "Scanning through property videos...",
  "Analyzing visual details...",
  "Finding the perfect matches...",
  "Inspecting kitchen countertops...",
  "Checking out the backyards...",
  "Peeking through windows for natural light...",
  "Measuring ceiling heights...",
  "Admiring the floor plans...",
  "Evaluating curb appeal...",
  "Touring virtual open houses..."
];

const ResultsView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);

  const onBack = () => navigate('/');

  const onResultClick = (result: SearchResult) => {
    navigate(`/property/${result.property.ragieId || result.property.id}/${result.id}`, {
      state: {
        property: result.property,
        // Use YouTube when available, skip Ragie stream
        streamUrl: result.property.youtubeId ? undefined : result.streamUrl,
        startTime: result.timestampSeconds,
        endTime: result.timestampSeconds + result.durationSeconds,
        selfText: result.selfText
      }
    });
  };
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Rotate loading messages
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoading]);

  const fetchResults = async (q: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await searchProperties(q);
      setResults(data);
    } catch (err: any) {
      setError(err.message || "Unable to perform search.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (query) {
      fetchResults(query);
    }
  }, [query]);

  const handleSearch = (newQuery: string) => {
    setQuery(newQuery);
    setSearchParams({ q: newQuery });
  };

  return (
    <div className="min-h-screen bg-cream">
       {/* Header */}
       <header className="bg-cream border-b-2 border-charcoal sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 rounded-none border-2 border-transparent hover:border-charcoal hover:bg-sand/50 text-charcoal transition-all"
            aria-label="Back to home"
          >
            <IconArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-terracotta border-2 border-charcoal flex items-center justify-center">
                <div className="w-3 h-3 bg-warmWhite rounded-full border-2 border-charcoal"></div>
             </div>
             <span className="font-display text-lg text-charcoal font-bold tracking-tight">PropertyLens</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Search Bar */}
        <div className="mb-12 max-w-3xl">
          <SearchBar 
            initialValue={query} 
            onSearch={handleSearch} 
            placeholder="Search..."
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-8">
             <div className="text-center mb-8">
               <div className="inline-block bg-terracotta text-warmWhite px-6 py-3 border-2 border-charcoal shadow-neobrutal-sm">
                 <p
                   key={loadingMessageIndex}
                   className="font-mono text-sm font-bold uppercase tracking-wider animate-slide-up"
                 >
                   {LOADING_MESSAGES[loadingMessageIndex]}
                 </p>
               </div>
             </div>
             <SearchHeaderSkeleton />
             <div className="mt-8 space-y-6">
               <ResultCardSkeleton />
               <ResultCardSkeleton />
               <ResultCardSkeleton />
             </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="py-8 animate-fade-in">
             <div className="bg-terracotta/5 border-2 border-charcoal p-8 text-center">
                <div className="w-12 h-12 mx-auto bg-terracotta text-white flex items-center justify-center rounded-full mb-4 shadow-neobrutal-sm border-2 border-charcoal">
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                     <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                   </svg>
                </div>
                <h2 className="font-display text-2xl font-bold text-charcoal mb-2">Search Failed</h2>
                <p className="font-mono text-sm text-olive mb-6">{error}</p>
                <button 
                  onClick={() => fetchResults(query)}
                  className="px-6 py-2 bg-charcoal text-warmWhite font-mono text-xs font-bold uppercase tracking-widest hover:bg-terracotta transition-colors border-2 border-charcoal"
                >
                  Try Again
                </button>
             </div>
          </div>
        )}

        {/* Results State */}
        {!isLoading && !error && (
          <div className="animate-fade-in">
            <div className="mb-8 flex items-baseline justify-between border-b-2 border-charcoal pb-4">
              <h2 className="font-display text-3xl md:text-4xl text-charcoal font-bold">
                Results for <span className="text-terracotta underline decoration-2 underline-offset-4 decoration-charcoal/20">"{query}"</span>
              </h2>
              <span className="text-charcoal font-mono font-bold uppercase tracking-wider text-xs bg-white px-3 py-1.5 border-2 border-charcoal shadow-neobrutal-sm">
                {results.length} matches
              </span>
            </div>

            <div className="space-y-6">
              {results.map((result, idx) => (
                <div key={result.id} className="animate-slide-up" style={{ animationDelay: `${idx * 100}ms` }}>
                  <ResultCard 
                    result={result} 
                    onWatch={() => onResultClick(result)} 
                  />
                </div>
              ))}
            </div>
            
            {results.length === 0 && (
               <div className="text-center py-20 px-6 bg-warmWhite border-2 border-dashed border-charcoal/30">
                 <p className="text-charcoal font-display text-2xl mb-2 font-bold">No exact matches found.</p>
                 <p className="text-olive font-mono text-sm">Try searching for things like <span className="text-terracotta font-bold">"kitchen"</span>, <span className="text-terracotta font-bold">"backyard"</span>, or <span className="text-terracotta font-bold">"modern"</span>.</p>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsView;
