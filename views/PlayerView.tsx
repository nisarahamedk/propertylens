import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import ChapterTimeline, { toChapters } from '../components/ChapterTimeline';
import ChatPanel from '../components/ChatPanel';
import { RoomsPanel, SearchPanel } from '../components/TourPanels';
import VideoPlayer, { type VideoPlayerHandle } from '../components/VideoPlayer';
import { evidenceFor, homeFacts, homeTitle, searchParts } from '../lib/match';
import { getProperty, searchTours } from '../services/api';
import type { Moment, Property, SearchResponse } from '../types';

type Tab = 'search' | 'rooms' | 'ask' | 'about';

const TAB_LABELS: Record<Tab, string> = { search: 'Your search', rooms: 'Rooms', ask: 'Ask', about: 'About' };

/** A fresh player per home, so stepping to the next result starts clean. */
const PlayerView: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  return <Player key={id} id={id} />;
};

const About: React.FC<{ property: Property }> = ({ property }) => (
  <div>
    <p className="text-charcoal text-base lg:text-lg leading-relaxed max-w-3xl">{property.summary || property.description}</p>
    {property.highlights && property.highlights.length > 0 && (
      <ul className="mt-4 flex flex-wrap gap-1.5">
        {property.highlights.map(h => (
          <li key={h} className="px-2.5 py-1 bg-warmWhite border-[1.5px] border-charcoal/25 text-[13px]">{h}</li>
        ))}
      </ul>
    )}
    <p className="mt-5 text-xs font-mono text-olive">
      Tour video by {property.channelName} on{' '}
      <a href={`https://www.youtube.com/watch?v=${property.youtubeId}`} target="_blank" rel="noreferrer" className="underline">
        YouTube
      </a>
      .
    </p>
  </div>
);

const Player: React.FC<{ id: string }> = ({ id }) => {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const property = getProperty(id);
  const query = params.get('q') || '';
  const startAt = Number(params.get('t') || 0);

  const playerRef = useRef<VideoPlayerHandle>(null);
  const [currentTime, setCurrentTime] = useState(startAt);
  const [tab, setTab] = useState<Tab>(query ? 'search' : 'rooms');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const passed = (location.state as { moments?: Moment[] } | null)?.moments;

  // The search is cached from the results page; a shared link runs it again.
  useEffect(() => {
    if (!query) return;
    searchTours(query).then(setResults).catch(() => {});
  }, [query]);

  const rank = results?.matches.findIndex(m => m.property.id === id) ?? -1;
  const matches = passed ?? (rank >= 0 ? results!.matches[rank].moments : []);
  const parts = useMemo(() => (results ? searchParts(results.interpreted.filters, results.interpreted.semantic) : []), [results]);
  const showSearch = Boolean(query && results && rank >= 0);

  const playerBoxRef = useRef<HTMLDivElement>(null);
  const seek = useCallback((t: number) => {
    playerRef.current?.seekTo(t);
    setCurrentTime(t);
    // On a wide screen the side panel stays put while the page scrolls; bring the video back into view.
    const box = playerBoxRef.current?.getBoundingClientRect();
    if (box && (box.top < 0 || box.bottom > window.innerHeight)) {
      playerBoxRef.current!.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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

  const chapters = property.chapters?.length ? property.chapters : toChapters(property.segments, property.duration);

  // Step through the other homes from the same search without going back to the list.
  const goTo = (offset: number) => {
    if (!results) return undefined;
    const target = results.matches[rank + offset];
    if (!target) return undefined;
    return () => {
      const m = evidenceFor(target.moments, results.interpreted.semantic)?.moment;
      navigate(`/property/${target.property.id}?t=${m ? Math.floor(m.start) : 0}&q=${encodeURIComponent(query)}`, {
        state: { moments: target.moments },
      });
    };
  };
  const prev = showSearch ? goTo(-1) : undefined;
  const next = showSearch ? goTo(1) : undefined;
  const nextHome = showSearch && results!.matches[rank + 1];

  const tabs: Tab[] = [...(showSearch ? (['search'] as Tab[]) : []), 'rooms', 'ask', 'about'];
  const active: Tab = tabs.includes(tab) ? tab : 'rooms';

  const stepButton = (label: string, onClick?: () => void) => (
    <button
      onClick={onClick}
      disabled={!onClick}
      aria-label={label === '‹' ? 'Previous home' : 'Next home'}
      className="w-9 h-9 border-2 border-charcoal font-mono font-bold text-charcoal bg-warmWhite hover:bg-terracotta hover:text-white disabled:opacity-30 disabled:hover:bg-warmWhite disabled:hover:text-charcoal"
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <AppHeader back={query ? `/search?q=${encodeURIComponent(query)}` : -1} stickOnPhones={false}>
        {showSearch ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-olive">
                Home {rank + 1} of {results!.matches.length} for
              </p>
              <p className="truncate text-sm md:text-[15px] font-semibold text-charcoal">{query}</p>
            </div>
            <div className="flex gap-1">
              {stepButton('‹', prev)}
              {stepButton('›', next)}
            </div>
          </div>
        ) : (
          <p className="truncate font-display font-bold text-charcoal uppercase tracking-tight">{homeTitle(property)}</p>
        )}
      </AppHeader>

      <main className="flex-1 w-full max-w-7xl mx-auto lg:px-6 lg:py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 lg:items-start">
        <div className="min-w-0">
          {/* On a phone the video and room bar stay pinned while the tabs scroll beneath them. */}
          <div ref={playerBoxRef} className="sticky top-0 z-30 lg:static bg-cream scroll-mt-20">
            <div className="lg:border-2 lg:border-charcoal bg-charcoal">
              <VideoPlayer ref={playerRef} youtubeId={property.youtubeId} startTime={startAt} onTimeUpdate={setCurrentTime} />
            </div>
            <div className="lg:mt-2">
              <ChapterTimeline chapters={chapters} duration={property.duration} currentTime={currentTime} matches={matches} onSeek={seek} />
            </div>
          </div>

          <section className="px-4 lg:px-0 pt-1 pb-3 lg:pt-5">
            <h1 className="font-display text-xl lg:text-3xl text-charcoal font-bold tracking-tight leading-tight">{homeTitle(property)}</h1>
            <p className="mt-1 font-mono text-[10px] lg:text-[11px] font-bold uppercase tracking-widest text-olive">
              {homeFacts(property, { location: true, rooms: true })}
            </p>
          </section>

          <div className="hidden lg:block mt-3">
            <About property={property} />
          </div>
        </div>

        <aside className="flex flex-col lg:sticky lg:top-24 lg:h-[calc(100vh-128px)] lg:border-2 lg:border-charcoal lg:bg-warmWhite lg:shadow-neobrutal">
          <div role="tablist" className="flex border-b-2 border-charcoal">
            {tabs.map(t => (
              <button
                key={t}
                role="tab"
                aria-selected={active === t}
                onClick={() => setTab(t)}
                className={`flex-1 pt-3 pb-2 border-b-[3px] -mb-[2px] font-display font-bold uppercase tracking-tight text-[13px] whitespace-nowrap transition-colors ${
                  t === 'about' ? 'lg:hidden' : ''
                } ${active === t ? 'border-terracotta text-charcoal' : 'border-transparent text-charcoal/50 hover:text-charcoal'}`}
              >
                {TAB_LABELS[t]}
                {t === 'rooms' && <span className="hidden lg:inline"> · {chapters.length}</span>}
              </button>
            ))}
          </div>

          <div className={active === 'ask' ? 'hidden' : 'lg:flex-1 lg:min-h-0 lg:overflow-y-auto p-4'}>
            {active === 'search' && showSearch && (
              <SearchPanel
                property={property}
                parts={parts}
                semantic={results!.interpreted.semantic}
                moments={matches}
                currentTime={currentTime}
                onSeek={seek}
                next={next && nextHome ? { title: homeTitle(nextHome.property), onClick: next } : undefined}
              />
            )}
            {active === 'rooms' && (
              <RoomsPanel
                chapters={chapters}
                currentTime={currentTime}
                matches={matches}
                fallbackImage={property.thumbnailUrl}
                onSeek={seek}
              />
            )}
            {/* About sits under the video on a wide screen, so its tab only exists on a phone. */}
            {active === 'about' && (
              <div className="lg:hidden">
                <About property={property} />
              </div>
            )}
          </div>
          {/* Hidden rather than unmounted, so the conversation survives a look at another tab. */}
          <div className={active === 'ask' ? 'lg:flex-1 lg:min-h-0 flex flex-col' : 'hidden'}>
            <ChatPanel
              key={property.id}
              youtubeId={property.youtubeId}
              currentTime={currentTime}
              onSeek={seek}
              disabled={!property.segments.length}
            />
          </div>
        </aside>
      </main>
    </div>
  );
};

export default PlayerView;
