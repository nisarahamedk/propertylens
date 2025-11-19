
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import VideoPlayer from '../components/VideoPlayer';
import { Property } from '../types';
import { getRecentProperties } from '../services/searchService';
import { IconArrowLeft } from '../components/ui/Icons';

const PlayerView: React.FC = () => {
  const { documentId, chunkId } = useParams<{ documentId: string; chunkId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as any;
  const passedProperty = locationState?.property as Property | undefined;
  const passedStreamUrl = locationState?.streamUrl;
  const passedStartTime = locationState?.startTime || 0;
  const passedEndTime = locationState?.endTime || 0;
  const passedSelfText = locationState?.selfText || '';

  const [property, setProperty] = useState<Property | null>(null);
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [startTime, setStartTime] = useState(passedStartTime);
  const [endTime, setEndTime] = useState(passedEndTime);
  const [isLoadingProperty, setIsLoadingProperty] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  // Load property data from documentId
  useEffect(() => {
    const loadProperty = async () => {
      if (!documentId) return;
      setIsLoadingProperty(true);
      try {
        // Use passed property from navigation state
        if (passedProperty) {
          setProperty(passedProperty);
        } else {
          // Fallback to recent properties list
          const data = await getRecentProperties();
          const found = data.properties.find(p => p.ragieId === documentId || p.id === documentId);
          if (found) {
            setProperty(found);
          }
        }

        // Use passed stream URL from search results, or show error
        if (passedStreamUrl) {
          setStreamUrl(passedStreamUrl);
        } else {
          // No stream URL passed - user must search to get chunk-level streams
          setStreamUrl('');
        }
      } catch (e) {
        // Failed to load property
      } finally {
        setIsLoadingProperty(false);
      }
    };
    loadProperty();
  }, [documentId, passedProperty, passedStreamUrl]);

  const onBack = () => navigate(-1);

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  // Loading state
  if (isLoadingProperty || !property) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-terracotta animate-pulse mx-auto mb-4"></div>
          <p className="font-mono text-sm text-olive">Loading property...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col animate-fade-in">
       {/* Header */}
       <header className="bg-cream sticky top-0 z-40 border-b-2 border-charcoal">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center relative">
          <button
            onClick={onBack}
            className="absolute left-4 flex items-center gap-2 text-charcoal hover:text-terracotta transition-colors"
          >
            <div className="p-2 border-2 border-charcoal bg-warmWhite hover:bg-charcoal hover:text-warmWhite transition-all shadow-neobrutal-sm">
              <IconArrowLeft className="w-4 h-4" />
            </div>
            <span className="hidden sm:inline font-mono font-bold text-xs uppercase tracking-wider">Back</span>
          </button>

          <div className="w-full text-center">
             <span className="font-mono text-olive/60 text-xs font-bold uppercase tracking-widest mr-2">Viewing</span>
             <span className="font-display text-lg text-terracotta font-bold uppercase tracking-wide border-b-2 border-terracotta/30 pb-0.5">
               {property.name}
             </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 lg:py-10 flex flex-col lg:flex-row gap-8 w-full">
        {/* Left Column: Player */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="bg-black mb-8 relative group border-2 border-charcoal">
            <VideoPlayer
              videoUrl={property.videoUrl}
              streamUrl={streamUrl}
              youtubeId={property.youtubeId}
              startTime={startTime}
              endTime={endTime}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>

          <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
             <h1 className="font-display text-4xl md:text-5xl text-charcoal mb-4 font-bold uppercase tracking-tight leading-none">
               {property.name}
             </h1>

             {/* Metadata Tags */}
             <div className="flex flex-wrap items-center gap-4 mb-8 border-b-2 border-charcoal pb-8">
               <span className="inline-block bg-clay/30 text-charcoal border-2 border-charcoal px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider">
                 {property.address}
               </span>
               <div className="text-xs font-mono font-bold tracking-widest text-olive/80 uppercase flex items-center gap-3">
                 <span>{property.beds} Bed</span>
                 <span className="text-charcoal/30">/</span>
                 <span>{property.baths} Bath</span>
                 <span className="text-charcoal/30">/</span>
                 <span>{property.sqft} SqFt</span>
               </div>
             </div>

             {property.description && (
               <p className="text-charcoal text-lg leading-relaxed max-w-3xl font-sans font-medium text-opacity-80">
                 {property.description}
               </p>
             )}
          </div>
        </div>

        {/* Right Column: Scene Description */}
        <div className="w-full lg:w-[400px] shrink-0 flex flex-col h-[600px] lg:h-[calc(100vh-140px)] lg:sticky lg:top-24 border-2 border-charcoal shadow-neobrutal bg-charcoal">
          <div className="p-5 border-b border-white/10">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-1.5 h-6 bg-terracotta"></div>
              <h3 className="font-display text-2xl font-bold text-warmWhite uppercase tracking-tight">Scene</h3>
            </div>
            <p className="text-xs font-mono text-warmWhite/60 ml-5">Scene details</p>
          </div>

          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
            {passedSelfText ? (
              <div className="text-warmWhite/90 text-sm font-sans leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:text-warmWhite prose-strong:text-warmWhite prose-li:my-0.5">
                <ReactMarkdown>
                  {(() => {
                    try {
                      const parsed = JSON.parse(passedSelfText);
                      return parsed.video_description || passedSelfText;
                    } catch {
                      return passedSelfText;
                    }
                  })()}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-warmWhite/40 text-sm font-mono italic">
                No description available for this segment.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PlayerView;
