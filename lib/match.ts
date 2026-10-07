// Explains a search result in terms of the search itself: which parts of the
// query the listing confirms, and where in the tour the rest was seen or said.

import type { Chapter, Moment, Property, SearchFilters } from '../types';
import { formatPrice, formatTime, queryTerms } from './format';
import { matchThing, thingQuery } from './phrase';

type Home = Omit<Property, 'segments'>;

export interface SearchPart {
  label: string;               // as the buyer would say it, e.g. "3+ beds"
  source: 'listing' | 'video';
}

export interface PartCheck {
  part: SearchPart;
  status: 'yes' | 'partly' | 'no';
  detail: string;              // e.g. "3 bed, from the listing"
}

export interface Evidence {
  moment: Moment;
  status: 'yes' | 'partly' | 'similar';
  found: string[];             // query words the tour confirms
  missing: string[];           // query words it does not
  how: 'Seen' | 'Said' | 'Seen and said' | 'Closest match';
  seen: string[];              // query words in what the video shows: the caption or the room's name
  said: string[];              // query words in the quote below
  quote?: string;              // the transcript sentence that says the most of the search
  looks: string[];             // colour or material words of the search ("black"), which only count on the thing itself
  seenPhrase?: string;         // the caption's words for the whole search, e.g. "dark countertops"
  saidPhrase?: string;         // the quote's words for it
  pictured: boolean;           // the room's photo shows the search
  verified: boolean;           // judged by the model, not by matching words
}

export const stem = (word: string) => (word.length > 4 ? word.replace(/(ing|ed|es|s|er)$/, '') : word);

/** True when the text contains a word sharing the term's stem ("fenced" finds "fencing"). */
function mentions(text: string, term: string): boolean {
  const s = stem(term);
  return text.toLowerCase().split(/[^a-z0-9]+/).some(w => w.startsWith(s) && w.length - s.length <= 4);
}

export function searchParts(filters: SearchFilters, semantic: string): SearchPart[] {
  const parts: SearchPart[] = [];
  if (filters.minBeds) parts.push({ label: `${filters.minBeds}+ beds`, source: 'listing' });
  if (filters.minBaths) parts.push({ label: `${filters.minBaths}+ baths`, source: 'listing' });
  if (filters.minSqft) parts.push({ label: `${filters.minSqft.toLocaleString()}+ sq ft`, source: 'listing' });
  if (filters.minPrice && filters.maxPrice) parts.push({ label: `${formatPrice(filters.minPrice)}–${formatPrice(filters.maxPrice)}`, source: 'listing' });
  else if (filters.maxPrice) parts.push({ label: `Under ${formatPrice(filters.maxPrice)}`, source: 'listing' });
  else if (filters.minPrice) parts.push({ label: `Over ${formatPrice(filters.minPrice)}`, source: 'listing' });
  for (const l of filters.locations ?? []) parts.push({ label: l, source: 'listing' });
  if (semantic.trim()) parts.push({ label: semantic.trim(), source: 'video' });
  return parts;
}

/** The model's verdict on a moment, in the shape the cards show. */
function verifiedEvidence(moment: Moment, terms: string[]): Evidence {
  const v = moment.verified!;
  const missingWords = queryTerms(v.missing ?? '');
  const missing = v.verdict === 'yes' ? [] : missingWords.length ? missingWords : [v.missing ?? 'some of it'];
  const found = terms.filter(t => !missing.includes(t));
  const seen = Boolean(v.seen || v.pictured);
  const sentences = moment.transcript.split(/(?<=[.!?])\s+/);
  const quote = v.said ? (sentences.find(s => s.includes(v.said!)) ?? v.said).trim() : undefined;
  return {
    moment,
    status: v.verdict,
    found,
    missing,
    how: seen && quote ? 'Seen and said' : quote ? 'Said' : 'Seen',
    seen: seen ? found : [],
    said: quote ? found : [],
    quote,
    looks: [],
    seenPhrase: v.seen,
    saidPhrase: v.said,
    pictured: v.pictured,
    verified: true,
  };
}

/** Picks the moment that best proves the search and says how much of it the tour confirms. */
export function evidenceFor(moments: Moment[], semantic: string): Evidence | null {
  if (!moments.length) return null;
  const terms = queryTerms(semantic);
  if (moments[0].verified) return verifiedEvidence(moments[0], terms);
  // "black countertops": "black" counts only where it describes the countertops,
  // and "dark countertops" counts for both words.
  const thing = thingQuery(semantic);
  const looks = thing?.looks.map(l => l.word) ?? [];
  const read = (text: string, extra = '') => {
    const m = thing ? matchThing(text, thing) : null;
    const words = new Set(terms.filter(t => mentions(`${extra} ${text}`, t)));
    if (m) {
      for (const l of looks) if (m.status !== 'confirmed') words.delete(l);
      if (m.status === 'confirmed') looks.forEach(l => words.add(l));
      if (m.status !== 'none') words.add(thing!.thing); // named another way: "sofa" for "couch"
    }
    return { words: terms.filter(t => words.has(t)), phrase: m?.status === 'confirmed' ? m.phrase : undefined };
  };
  const scored = moments.map(moment => {
    // The room the tour itself names ("Ensuite") counts as seen.
    const caption = read(moment.caption, moment.label);
    // A room still the server matched to the search shows every word of it.
    const seen = moment.pictured ? terms : caption.words;
    const spoken = read(moment.transcript);
    const said = spoken.words;
    const found = terms.filter(t => seen.includes(t) || said.includes(t));
    return { moment, seen, said, found, seenPhrase: caption.phrase, saidPhrase: spoken.phrase };
  });
  // Most query words confirmed wins; the server's order breaks ties.
  const best = scored.reduce((a, b) => (b.found.length > a.found.length ? b : a));
  const missing = terms.filter(t => !best.found.includes(t));
  const status = !best.found.length ? 'similar' : missing.length ? 'partly' : 'yes';
  const how =
    status === 'similar' ? 'Closest match'
      : best.seen.length && best.said.length ? 'Seen and said'
        : best.said.length ? 'Said' : 'Seen';
  // The sentence that says the most of the search. Earlier query words weigh more,
  // since they tend to be the specific ones ("fenced" in "fenced backyard").
  const sentences = best.moment.transcript.split(/(?<=[.!?])\s+/);
  const said = (s: string) =>
    (best.saidPhrase && s.includes(best.saidPhrase) ? 100 : 0) +
    best.said.reduce((n, t) => n + (mentions(s, t) && !looks.includes(t) ? terms.length - terms.indexOf(t) : 0), 0);
  const quote = best.said.length ? sentences.reduce((a, b) => (said(b) > said(a) ? b : a)).trim() : undefined;
  return {
    moment: best.moment,
    status,
    found: best.found,
    missing,
    how,
    seen: best.seen,
    said: quote ? best.said.filter(t => mentions(quote, t)) : [],
    quote,
    looks,
    seenPhrase: best.seenPhrase,
    saidPhrase: best.saidPhrase && quote?.includes(best.saidPhrase) ? best.saidPhrase : undefined,
    pictured: Boolean(best.moment.pictured),
    verified: false,
  };
}

/** One check per search part, for a home in the results. */
export function checkHome(home: Home, parts: SearchPart[], evidence: Evidence | null): PartCheck[] {
  return parts.map(part => {
    if (part.source === 'video') {
      if (!evidence) return { part, status: 'no', detail: 'Not found in the tour' };
      const at = formatTime(evidence.moment.start);
      if (evidence.status === 'yes') return { part, status: 'yes', detail: `${evidence.how} at ${at}` };
      if (evidence.status === 'partly') {
        return { part, status: 'partly', detail: `${capitalize(evidence.found.join(' '))} at ${at}, “${evidence.missing.join(' ')}” not confirmed` };
      }
      return { part, status: 'partly', detail: `Closest match at ${at}` };
    }
    // Listing parts were applied as filters by the server, so they hold; say what the listing shows.
    const label = part.label.toLowerCase();
    let shown = part.label;
    if (label.endsWith('beds')) shown = `${home.beds} bed`;
    else if (label.endsWith('baths')) shown = `${home.baths} bath`;
    else if (label.endsWith('sq ft')) shown = `${home.sqft.toLocaleString()} sq ft`;
    else if (/^(under|over|\$)/.test(label)) shown = formatPrice(home.priceValue) || 'Price not listed';
    else shown = home.address && home.address !== home.location ? `${home.address}, ${part.label}` : home.location;
    return { part, status: 'yes', detail: shown };
  });
}

/** Short tick-list label for a result card: "3 bed", "Surrey", "Fenced backyard". */
export function shortCheck(check: PartCheck): string {
  if (check.part.source === 'video') return capitalize(check.part.label);
  const l = check.part.label.toLowerCase();
  if (l.endsWith('beds') || l.endsWith('baths') || l.endsWith('sq ft') || /^(under|over|\$)/.test(l)) return check.detail;
  return check.part.label;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The street address when the listing has one, otherwise the area. */
export function homeTitle(home: Home): string {
  return home.address && home.address !== home.location ? home.address : home.name;
}

/** "Surrey · $1.3M · 3 bed · 1 bath · 1:14 tour · 12 rooms", leaving out what the listing lacks. */
export function homeFacts(home: Home, opts: { location?: boolean; rooms?: boolean } = {}): string {
  return [
    opts.location && home.address && home.address !== home.location ? home.location : null,
    formatPrice(home.priceValue) || null,
    home.beds ? `${home.beds} bed` : null,
    home.baths ? `${home.baths} bath` : null,
    home.sqft ? `${home.sqft.toLocaleString()} sq ft` : null,
    home.duration ? `${formatTime(home.duration)} tour` : null,
    opts.rooms && roomCount(home.chapters) ? `${roomCount(home.chapters)} rooms` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// Chapters that are not a place in the home: the agent on camera, title cards, logos.
const NOT_A_PLACE = /\b(logo|agent|title card|contact|intro|outro|talking head|interview|aerial)\b/i;

/** The places a buyer can jump to, once each, in the order the tour first visits them. */
export function tourPlaces(chapters: Chapter[]): Chapter[] {
  const seen = new Set<string>();
  return chapters.filter(c => {
    const key = c.label.toLowerCase();
    if (NOT_A_PLACE.test(c.label) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Distinct rooms inside the home, for "10 rooms": no exteriors, yards, views, nearby places or agent shots. */
export function roomCount(chapters: Chapter[] = []): number {
  return tourPlaces(chapters).filter(c => !['exterior', 'backyard', 'view', 'amenity', 'other'].includes(c.room)).length;
}

const COVER_ROOMS = ['Living room', 'Kitchen', 'Family room', 'Dining area', 'Great room'];

/** A clean room still for a card, instead of the YouTube cover with its baked-in text. */
export function coverImage(home: Home): string {
  const frames = (home.chapters ?? []).filter(c => c.frame);
  const pick = COVER_ROOMS.map(label => frames.find(c => c.label === label)).find(Boolean)
    ?? frames.find(c => c.room === 'living' || c.room === 'kitchen');
  return pick?.frame ?? home.thumbnailUrl;
}
