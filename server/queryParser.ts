// Splits a natural-language query into hard filters (beds, price, location)
// and the descriptive part that should be matched against the videos.

import type { SearchFilters } from '../types';
import { generateJson } from './gemini';

export interface ParsedQuery {
  semantic: string;
  filters: SearchFilters;
}

// Cheap check so plain descriptive queries skip the LLM round trip.
const FILTER_HINT = /\d|\bbed|\bbath|\bbr\b|\$|\bunder\b|\bbelow\b|\bover\b|\bmillion\b|\bsq\s?ft|\bsquare\b|\bin\s+[A-Z]/i;

export function looksFiltered(q: string, locations: string[]): boolean {
  if (FILTER_HINT.test(q)) return true;
  const lower = q.toLowerCase();
  return locations.some(l => lower.includes(l.toLowerCase()));
}

function money(raw: string, unit?: string): number {
  const n = parseFloat(raw.replace(/,/g, ''));
  const u = (unit || '').toLowerCase();
  if (u.startsWith('m')) return n * 1_000_000;
  if (u.startsWith('k')) return n * 1_000;
  return n;
}

/** Regex fallback used without an API key, and to sanity-check the LLM output. */
export function parseWithRules(q: string, locations: string[]): ParsedQuery {
  const filters: SearchFilters = {};
  let rest = q;
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = rest.match(re);
    if (m) {
      fn(m);
      rest = rest.replace(m[0], ' ');
    }
  };

  take(/(\d+)\s*\+?\s*(?:bed(?:room)?s?|br|bd)\b/i, m => (filters.minBeds = Number(m[1])));
  take(/(\d+(?:\.\d)?)\s*\+?\s*(?:bath(?:room)?s?|ba)\b/i, m => (filters.minBaths = Number(m[1])));
  take(/(\d[\d,]*)\s*\+?\s*(?:sq\.?\s?ft|square\s+feet|sf)\b/i, m => (filters.minSqft = Number(m[1].replace(/,/g, ''))));
  take(/(?:under|below|less than|max(?:imum)?|up to)\s*\$?\s*(\d[\d,.]*)\s*(m(?:illion)?|k)?\b/i, m => (filters.maxPrice = money(m[1], m[2])));
  take(/(?:over|above|more than|min(?:imum)?|at least)\s*\$?\s*(\d[\d,.]*)\s*(m(?:illion)?|k)\b/i, m => (filters.minPrice = money(m[1], m[2])));

  const lower = rest.toLowerCase();
  const found = locations.filter(l => lower.includes(l.toLowerCase()));
  if (found.length) {
    filters.locations = found;
    for (const l of found) rest = rest.replace(new RegExp(`\\b(?:in|near|around)?\\s*${l}\\b`, 'i'), ' ');
  }

  const semantic = rest
    .replace(/\b(with|and|that has|which has|having|home|house|homes|houses|properties|property|a|an)\b/gi, ' ')
    .replace(/[,$]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { semantic: semantic || q, filters };
}

const SCHEMA = {
  type: 'object',
  properties: {
    semantic: { type: 'string', description: 'What the buyer wants to see or hear in the tour, with every filter removed.' },
    minBeds: { type: 'number', nullable: true },
    minBaths: { type: 'number', nullable: true },
    minSqft: { type: 'number', nullable: true },
    minPrice: { type: 'number', nullable: true },
    maxPrice: { type: 'number', nullable: true },
    locations: { type: 'array', items: { type: 'string' } },
  },
  required: ['semantic', 'locations'],
};

export async function parseWithModel(q: string, locations: string[], apiKey: string): Promise<ParsedQuery> {
  const out = await generateJson<any>(
    [{ role: 'user', parts: [{ text: q }] }],
    apiKey,
    {
      schema: SCHEMA,
      temperature: 0,
      system:
        'You turn a home buyer\'s search into structured filters for a video search engine. ' +
        'Extract numeric constraints (bedrooms, bathrooms, square feet, price in CAD as a plain number) only when stated. ' +
        `Map places to this exact list when they match, otherwise leave locations empty: ${locations.join(', ')}. ` +
        'Put everything descriptive (rooms, finishes, views, style, things an agent might say) into "semantic". ' +
        'If nothing descriptive remains, use a short phrase like "house tour".',
    },
  );
  const known = new Set(locations.map(l => l.toLowerCase()));
  const filters: SearchFilters = {};
  for (const key of ['minBeds', 'minBaths', 'minSqft', 'minPrice', 'maxPrice'] as const) {
    if (typeof out[key] === 'number' && out[key] > 0) filters[key] = out[key];
  }
  const locs = (out.locations ?? []).filter((l: string) => known.has(String(l).toLowerCase()));
  if (locs.length) filters.locations = locs;
  return { semantic: String(out.semantic || q).trim(), filters };
}
