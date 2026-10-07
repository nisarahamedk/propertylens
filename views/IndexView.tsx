import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import PropertyThumbnail from '../components/PropertyThumbnail';
import { properties } from '../services/api';

const city = (location: string) => location.split(',').pop()!.trim();

const IndexView: React.FC = () => {
  const navigate = useNavigate();
  const [area, setArea] = useState('All');
  const [minBeds, setMinBeds] = useState(0);

  const areas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of properties) counts.set(city(p.location), (counts.get(city(p.location)) ?? 0) + 1);
    return ['All', ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)];
  }, []);

  const shown = properties.filter(
    p => (area === 'All' || city(p.location) === area) && (!minBeds || p.beds >= minBeds),
  );

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader back="/" />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="mb-6 flex items-baseline justify-between border-b-2 border-charcoal pb-4">
          <h1 className="font-display text-3xl md:text-4xl text-charcoal font-bold">All tours</h1>
          <span className="text-charcoal font-mono font-bold uppercase tracking-wider text-xs bg-white px-3 py-1.5 border-2 border-charcoal shadow-neobrutal-sm">
            {shown.length} of {properties.length}
          </span>
        </div>

        <div className="mb-10 flex flex-wrap items-center gap-2">
          {areas.map(a => (
            <button
              key={a}
              onClick={() => setArea(a)}
              className={`px-3 py-1.5 border-2 border-charcoal font-mono text-xs font-bold uppercase ${
                area === a ? 'bg-charcoal text-warmWhite' : 'bg-warmWhite text-charcoal hover:bg-sand'
              }`}
            >
              {a}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 font-mono text-xs font-bold uppercase text-charcoal">
            Beds
            <select
              id="min-beds"
              value={minBeds}
              onChange={e => setMinBeds(Number(e.target.value))}
              className="bg-warmWhite border-2 border-charcoal px-2 py-1"
            >
              {[0, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n ? `${n}+` : 'Any'}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 md:gap-x-6 gap-y-6 md:gap-y-10">
          {shown.map(p => (
            <PropertyThumbnail key={p.id} property={p} onClick={() => navigate(`/property/${p.id}`)} />
          ))}
        </div>
        {shown.length === 0 && (
          <p className="text-center py-16 font-mono text-sm text-olive border-2 border-dashed border-charcoal/30">
            No tours match these filters.
          </p>
        )}
      </main>
    </div>
  );
};

export default IndexView;
