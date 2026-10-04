import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import ChapterTimeline from '../components/ChapterTimeline';
import ChatPanel from '../components/ChatPanel';
import ScenePanel from '../components/ScenePanel';
import VideoPlayer, { type VideoPlayerHandle } from '../components/VideoPlayer';
import { formatPrice, queryTerms } from '../lib/format';
import { getProperty, searchTours } from '../services/api';
import type { Moment } from '../types';

type Tab = 'scenes' | 'ask';

const PlayerView: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const location = useLocation();
  const property = getProperty(id);
  const query = params.get('q') || '';
  const startAt = Number(params.get('t') || 0);

  const playerRef = useRef<VideoPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(startAt);
  const [tab, setTab] = useState<Tab>('scenes');
  const [matches, setMatches] = useState<Moment[]>(
    () => (location.state as { moments?: Moment[] } | null)?.moments ?? [],
  );

  // Opened from a shared link: recover this tour's matches by re-running the search.
  useEffect(() => {
    if (!query || matches.length || !property) return;
    searchTours(query)
      .then(r => setMatches(r.matches.find(m => m.property.id === property.id)?.moments ?? []))
      .catch(() => {});
  }, [query, property, matches.length]);

  const playerBoxRef = useRef<HTMLDivElement>(null);
  const seek = useCallback((t: number) => {
    playerRef.current?.seekTo(t);
    setCurrentTime(t);
    // On a phone the scene list and chat sit below the video; bring it back into view.
    const box = playerBoxRef.current?.getBoundingClientRect();
    if (box && (box.top < 0 || box.bottom > window.innerHeight)) {
      playerBoxRef.current!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const matchedIds = useMemo(() => new Set(matches.map(m => m.segmentId)), [matches]);
  const terms = useMemo(() => queryTerms(query), [query]);

  if (!property) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader back="/" />
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <h1 className="font-display text-3xl font-bold text-charcoal mb-3">Tour not found</h1>
          <p className="text-olive mb-6">This tour is not in the index. It may have been removed.</p>
          <Link to="/index" className="font-mono text-xs font-bold uppercase tracking-widest border-b-2 border-charcoal">
            Browse all tours
          </Link>
        </div>
      </div>
    );
  }

  const facts = [
    property.beds ? `${property.beds} bed` : null,
    property.baths ? `${property.baths} bath` : null,
    property.sqft ? `${property.sqft.toLocaleString()} sq ft` : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <AppHeader back={-1}>
        <p className="truncate font-display font-bold text-charcoal uppercase tracking-tight">{property.name}</p>
      </AppHeader>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-6 lg:py-8 flex flex-col lg:flex-row gap-8 w-full">
        <div className="flex-1 min-w-0">
          <div ref={playerBoxRef} className="border-2 border-charcoal bg-charcoal scroll-mt-20">
            <VideoPlayer ref={playerRef} youtubeId={property.youtubeId} startTime={startAt} onTimeUpdate={setCurrentTime} />
          </div>
          <ChapterTimeline
            segments={property.segments}
            duration={property.duration}
            currentTime={currentTime}
            matches={matches}
            onSeek={seek}
          />

          <section className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
              <h1 className="font-display text-3xl md:text-4xl text-charcoal font-bold uppercase tracking-tight leading-none">
                {property.name}
              </h1>
              {property.priceValue && (
                <span className="font-mono font-bold text-xl text-terracotta">{formatPrice(property.priceValue)}</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-6 pb-6 border-b-2 border-charcoal">
              <span className="bg-clay/40 border-2 border-charcoal px-3 py-1 font-mono text-xs font-bold uppercase">{property.address}</span>
              {facts.length > 0 && (
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-olive">{facts.join(' / ')}</span>
              )}
            </div>
            <p className="text-charcoal text-lg leading-relaxed max-w-3xl">{property.summary || property.description}</p>
            {property.highlights && property.highlights.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {property.highlights.map(h => (
                  <li key={h} className="px-3 py-1 bg-warmWhite border-2 border-charcoal text-sm">{h}</li>
                ))}
              </ul>
            )}
            <p className="mt-6 text-xs font-mono text-olive">
              Tour video by {property.channelName} on{' '}
              <a href={`https://www.youtube.com/watch?v=${property.youtubeId}`} target="_blank" rel="noreferrer" className="underline">
                YouTube
              </a>
              .
            </p>
          </section>
        </div>

        <aside className="w-full lg:w-[400px] shrink-0 flex flex-col h-[640px] lg:h-[calc(100vh-120px)] lg:sticky lg:top-20 border-2 border-charcoal shadow-neobrutal bg-charcoal">
          <div role="tablist" className="flex border-b-2 border-charcoal">
            {(['scenes', 'ask'] as Tab[]).map(t => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 font-display font-bold uppercase tracking-tight text-lg transition-colors ${
                  tab === t ? 'bg-terracotta text-white' : 'text-warmWhite/70 hover:text-warmWhite'
                }`}
              >
                {t === 'scenes' ? `Scenes${property.segments.length ? ` · ${property.segments.length}` : ''}` : 'Ask the tour'}
              </button>
            ))}
          </div>
          <div className={`flex-1 min-h-0 ${tab === 'scenes' ? 'overflow-y-auto' : 'flex flex-col'}`}>
            {tab === 'scenes' ? (
              <ScenePanel
                segments={property.segments}
                currentTime={currentTime}
                matchedIds={matchedIds}
                terms={terms}
                fallbackImage={property.thumbnailUrl}
                onSeek={seek}
              />
            ) : (
              <ChatPanel
                youtubeId={property.youtubeId}
                currentTime={currentTime}
                onSeek={seek}
                disabled={!property.segments.length}
              />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default PlayerView;
