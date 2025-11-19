
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowLeft } from '../components/ui/Icons';
import PropertyThumbnail from '../components/PropertyThumbnail';
import { Property } from '../types';
import { getRecentProperties } from '../services/searchService';
import { PropertyThumbnailSkeleton } from '../components/ui/Skeletons';

const IndexView: React.FC = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalDocs, setTotalDocs] = useState<number | undefined>();

  const fetchProperties = async (cursor?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getRecentProperties(cursor);
      setProperties(data.properties);
      setNextCursor(data.nextCursor);
      if (data.total !== undefined) setTotalDocs(data.total);
    } catch (err: any) {
      setError(err.message || "Failed to load properties.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const goToNextPage = () => {
    if (nextCursor) {
      // Store the cursor that will get us to the next page
      setCursorHistory(prev => [...prev, nextCursor]);
      setCurrentPage(prev => prev + 1);
      fetchProperties(nextCursor);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage <= 1) return;

    const newHistory = [...cursorHistory];
    newHistory.pop(); // Remove the cursor for current page
    setCursorHistory(newHistory);
    setCurrentPage(prev => prev - 1);

    // Use the last cursor in history, or undefined for page 1
    const previousCursor = newHistory.length > 0 ? newHistory[newHistory.length - 1] : undefined;
    fetchProperties(previousCursor);
  };

  const onPropertyClick = (property: Property) => {
    navigate(`/property/${property.ragieId || property.id}/overview`);
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-cream border-b-2 border-charcoal sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
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
        <div className="mb-8 flex items-baseline justify-between border-b-2 border-charcoal pb-4">
          <h1 className="font-display text-3xl md:text-4xl text-charcoal font-bold">
            All Properties
          </h1>
          <span className="text-charcoal font-mono font-bold uppercase tracking-wider text-xs bg-white px-3 py-1.5 border-2 border-charcoal shadow-neobrutal-sm">
            {totalDocs ?? properties.length} indexed
          </span>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
            {Array.from({ length: 8 }).map((_, i) => (
              <PropertyThumbnailSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="py-8 animate-fade-in">
            <div className="bg-terracotta/5 border-2 border-charcoal p-8 text-center">
              <h2 className="font-display text-2xl font-bold text-charcoal mb-2">Failed to Load</h2>
              <p className="font-mono text-sm text-olive mb-6">{error}</p>
              <button
                onClick={() => fetchProperties()}
                className="px-6 py-2 bg-charcoal text-warmWhite font-mono text-xs font-bold uppercase tracking-widest hover:bg-terracotta transition-colors border-2 border-charcoal"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Properties Grid */}
        {!isLoading && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12 animate-fade-in">
              {properties.length > 0 ? (
                properties.map((property, idx) => (
                  <div key={property.id} className="animate-slide-up" style={{ animationDelay: `${idx * 50}ms` }}>
                    <PropertyThumbnail
                      property={property}
                      onClick={() => onPropertyClick(property)}
                    />
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-16 border-2 border-dashed border-charcoal/20">
                  <p className="font-mono text-charcoal font-bold uppercase">No properties indexed</p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {(currentPage > 1 || nextCursor) && (
              <div className="mt-8 flex items-center justify-center gap-4">
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest border-2 border-charcoal transition-all ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-charcoal hover:bg-charcoal hover:text-warmWhite'
                  }`}
                >
                  Previous
                </button>
                <span className="font-mono text-sm text-charcoal font-bold">
                  Page {currentPage}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={!nextCursor}
                  className={`px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest border-2 border-charcoal transition-all ${
                    !nextCursor
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-charcoal hover:bg-charcoal hover:text-warmWhite'
                  }`}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default IndexView;
