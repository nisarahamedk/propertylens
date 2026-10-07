import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import MatchCard from '../components/MatchCard';
import SearchBar from '../components/SearchBar';
import SearchParts from '../components/SearchParts';
import { ResultCardSkeleton } from '../components/ui/Skeletons';
import { evidenceFor, searchParts } from '../lib/match';
import { searchTours, totalScenes } from '../services/api';
import type { Moment, PropertyMatch, SearchResponse } from '../types';

const EXAMPLES = ['Soaker tub in the ensuite', 'Kitchen island with bar seating', 'Fenced backyard'];

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

  const parts = useMemo(() => (data ? searchParts(data.interpreted.filters, data.interpreted.semantic) : []), [data]);
  const complete = useMemo(
    () => (data ? data.matches.filter(m => evidenceFor(m.moments, data.interpreted.semantic)?.status === 'yes').length : 0),
    [data],
  );

  const open = (match: PropertyMatch, moment?: Moment) => {
    const t = moment ? Math.floor(moment.start) : 0;
    navigate(`/property/${match.property.id}?t=${t}&q=${encodeURIComponent(query)}`, {
      state: { moments: match.moments },
    });
  };

  const filters = parts.filter(p => p.source === 'listing').map(p => p.label);

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader back="/">
        <div className="max-w-2xl">
          <SearchBar compact initialValue={query} onSearch={q => setParams({ q })} placeholder="Describe what you want to see…" />
        </div>
      </AppHeader>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
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
            <div className="mb-6 border-b-2 border-charcoal pb-4 md:pb-5 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
              <div className="flex flex-col gap-3 min-w-0">
                <h1 className="hidden md:block font-display text-3xl text-charcoal font-bold leading-tight">
                  {data.closest
                    ? 'No exact match. These are the closest homes.'
                    : `${data.matches.length} ${data.matches.length === 1 ? 'home matches' : 'homes match'} your search`}
                </h1>
                <SearchParts parts={parts} intro={parts.length > 1 ? 'Your search' : undefined} />
              </div>
              {data.matches.length > 0 && (
                <p className="text-sm text-olive md:text-right shrink-0">
                  <b className="md:hidden text-charcoal">
                    {data.matches.length} {data.matches.length === 1 ? 'home' : 'homes'}.{' '}
                  </b>
                  {complete === data.matches.length
                    ? 'Each one matches every part.'
                    : complete
                      ? `${complete} match every part, ${data.matches.length - complete} match some.`
                      : 'None matches every part. These come closest.'}
                </p>
              )}
            </div>

            {data.closest && (
              <div className="mb-6 bg-warmWhite border-2 border-charcoal p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                <p className="text-charcoal leading-snug flex-1">
                  No home that fits your filters ({filters.join(' · ')}) clearly shows{' '}
                  <strong>{data.interpreted.semantic}</strong>. These are the closest moments.
                </p>
                <button
                  onClick={() => setParams({ q: data.interpreted.semantic })}
                  className="self-start md:self-auto shrink-0 px-4 py-2 bg-charcoal text-warmWhite font-mono text-xs font-bold uppercase tracking-widest hover:bg-terracotta border-2 border-charcoal"
                >
                  Search “{data.interpreted.semantic}” in every home
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
              {data.matches.map((m, i) => (
                <div key={m.property.id} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                  <MatchCard match={m} parts={parts} semantic={data.interpreted.semantic} onOpen={moment => open(m, moment)} />
                </div>
              ))}
            </div>

            {data.matches.length === 0 && (
              <div className="text-center py-16 px-6 bg-warmWhite border-2 border-dashed border-charcoal/30">
                <p className="text-charcoal font-display text-2xl mb-2 font-bold">Nothing in these tours matches that yet.</p>
                {totalScenes === 0 ? (
                  <p className="text-olive font-mono text-sm">The index has no scenes. Run ingestion/build-index.ts to build it.</p>
                ) : filters.length ? (
                  <p className="text-olive font-mono text-sm">Try removing a filter, such as the price or the neighbourhood.</p>
                ) : (
                  <>
                    <p className="text-olive text-sm mb-4">Try describing a room, a finish or a view.</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {EXAMPLES.map(e => (
                        <button
                          key={e}
                          onClick={() => setParams({ q: e })}
                          className="px-3 py-1.5 bg-warmWhite border-2 border-charcoal font-mono text-xs font-bold uppercase hover:bg-terracotta hover:text-white"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ResultsView;
