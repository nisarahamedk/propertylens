import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import MatchCard, { type SignalScale } from '../components/MatchCard';
import SearchBar from '../components/SearchBar';
import { ResultCardSkeleton } from '../components/ui/Skeletons';
import { formatPrice, queryTerms } from '../lib/format';
import { searchTours, totalScenes } from '../services/api';
import type { Moment, PropertyMatch, SearchFilters, SearchResponse } from '../types';

function filterChips(f: SearchFilters): string[] {
  const chips: string[] = [];
  if (f.minBeds) chips.push(`${f.minBeds}+ beds`);
  if (f.minBaths) chips.push(`${f.minBaths}+ baths`);
  if (f.minSqft) chips.push(`${f.minSqft.toLocaleString()}+ sq ft`);
  if (f.minPrice && f.maxPrice) chips.push(`${formatPrice(f.minPrice)}–${formatPrice(f.maxPrice)}`);
  else if (f.maxPrice) chips.push(`Under ${formatPrice(f.maxPrice)}`);
  else if (f.minPrice) chips.push(`Over ${formatPrice(f.minPrice)}`);
  for (const l of f.locations ?? []) chips.push(l);
  return chips;
}

const ResultsView: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';

  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    searchTours(query, ctrl.signal)
      .then(setData)
      .catch(e => !ctrl.signal.aborted && setError(e.message))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [query]);

  const terms = useMemo(() => queryTerms(data?.interpreted.semantic || query), [data, query]);

  const scale: SignalScale = useMemo(() => {
    const all = data?.matches.flatMap(m => m.moments) ?? [];
    return {
      visual: Math.max(0, ...all.map(m => m.signals.visual)),
      speech: Math.max(0, ...all.map(m => m.signals.speech)),
    };
  }, [data]);

  const open = (match: PropertyMatch, moment?: Moment) => {
    const t = moment ? Math.floor(moment.start) : 0;
    navigate(`/property/${match.property.id}?t=${t}&q=${encodeURIComponent(query)}`, {
      state: { moments: match.moments },
    });
  };

  const chips = data ? filterChips(data.interpreted.filters) : [];
  const showInterpretation =
    data && (chips.length > 0 || data.interpreted.semantic.toLowerCase() !== query.trim().toLowerCase());

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader back="/">
        <div className="max-w-2xl">
          <SearchBar compact initialValue={query} onSearch={q => setParams({ q })} placeholder="Describe what you want to see…" />
        </div>
      </AppHeader>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {loading && (
          <div className="space-y-6" aria-busy="true">
            <p className="font-mono text-xs uppercase tracking-widest text-olive">
              Searching {totalScenes || 'every'} scenes for “{query}”…
            </p>
            <ResultCardSkeleton />
            <ResultCardSkeleton />
          </div>
        )}

        {error && !loading && (
          <div className="bg-terracotta/5 border-2 border-charcoal p-8 text-center">
            <h2 className="font-display text-2xl font-bold text-charcoal mb-2">Search failed</h2>
            <p className="font-mono text-sm text-olive mb-6">{error}</p>
            <button
              onClick={() => setParams({ q: query })}
              className="px-6 py-2 bg-charcoal text-warmWhite font-mono text-xs font-bold uppercase tracking-widest hover:bg-terracotta border-2 border-charcoal"
            >
              Try again
            </button>
          </div>
        )}

        {data && !loading && !error && (
          <div className="animate-fade-in">
            <div className="mb-8 border-b-2 border-charcoal pb-5 flex flex-col gap-3">
              <h1 className="font-display text-3xl md:text-4xl text-charcoal font-bold leading-tight">
                {data.matches.length} {data.matches.length === 1 ? 'home' : 'homes'} for{' '}
                <span className="text-terracotta">“{query}”</span>
              </h1>

              {showInterpretation && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-olive">Understood as</span>
                  <span className="px-2 py-0.5 bg-charcoal text-warmWhite font-mono text-xs">{data.interpreted.semantic}</span>
                  {chips.map(c => (
                    <span key={c} className="px-2 py-0.5 bg-warmWhite border-2 border-charcoal font-mono text-xs font-bold">
                      {c}
                    </span>
                  ))}
                </div>
              )}

              <p className="font-mono text-[11px] uppercase tracking-widest text-olive">
                {data.stats.segmentsSearched} scenes across {data.stats.propertiesConsidered} tours ·{' '}
                {data.stats.timings.total} ms ·{' '}
                {data.mode === 'hybrid' ? 'visual + speech + keyword' : 'keyword only'}
              </p>
            </div>

            <div className="space-y-6">
              {data.matches.map((m, i) => (
                <div key={m.property.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <MatchCard
                    match={m}
                    rank={i + 1}
                    terms={terms}
                    scale={scale}
                    hybrid={data.mode === 'hybrid'}
                    onOpen={moment => open(m, moment)}
                  />
                </div>
              ))}
            </div>

            {data.matches.length === 0 && (
              <div className="text-center py-16 px-6 bg-warmWhite border-2 border-dashed border-charcoal/30">
                <p className="text-charcoal font-display text-2xl mb-2 font-bold">Nothing in these tours matches that yet.</p>
                <p className="text-olive font-mono text-sm">
                  {totalScenes === 0
                    ? 'The index has no scenes. Run ingestion/build-index.ts to build it.'
                    : chips.length
                      ? 'Try removing a filter, such as the price or the neighbourhood.'
                      : 'Try describing a room, a finish or a view, like “wine cellar” or “mountain view from the deck”.'}
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ResultsView;
