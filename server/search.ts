import type { Chapter, Moment, Property, PropertyMatch, Room, SearchFilters, SearchResponse, Segment } from '../types.js';
import { RANKING } from './config.js';
import { embed, getApiKey, queryText } from './gemini.js';
import { looksFiltered, parseWithModel, parseWithRules, type ParsedQuery } from './queryParser.js';
import { bm25, dot, loadStore, tokenize, withoutSegments, type IndexedSegment, type Store } from './store.js';

/** Place names that the query parser can map to: every comma part of each property's location. */
export function knownLocations(store: Store): string[] {
  const set = new Set<string>();
  for (const p of store.catalog.properties) {
    for (const part of p.location.split(',')) {
      const t = part.trim();
      if (t && !/canada|^bc$/i.test(t)) set.add(t);
    }
  }
  return [...set].sort((a, b) => b.length - a.length);
}

export function matchesFilters(p: Property, f: SearchFilters): boolean {
  if (f.minBeds && p.beds < f.minBeds) return false;
  if (f.minBaths && p.baths < f.minBaths) return false;
  if (f.minSqft && p.sqft < f.minSqft) return false;
  if (f.maxPrice && (!p.priceValue || p.priceValue > f.maxPrice)) return false;
  if (f.minPrice && (!p.priceValue || p.priceValue < f.minPrice)) return false;
  if (f.locations?.length) {
    const hay = `${p.location} ${p.address}`.toLowerCase();
    if (!f.locations.some(l => hay.includes(l.toLowerCase()))) return false;
  }
  return true;
}

interface Scored {
  doc: IndexedSegment;
  visual: number;
  speech: number;
  keyword: number;
  still: number;
  stillChapter: Chapter | null; // the room whose still scored `still`
  blended: number;
  fused: number;
}

function rankOf<T>(items: T[], key: (t: T) => number): Map<T, number> {
  const sorted = [...items].sort((a, b) => key(b) - key(a));
  return new Map(sorted.map((t, i) => [t, key(t) > 0 ? i + 1 : Infinity]));
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

// Words that point a query at a kind of room. Matched against tokenized query terms.
const ROOM_WORDS: Partial<Record<Room, string[]>> = {
  kitchen: ['kitchen', 'island', 'pantry', 'countertop', 'counter', 'cabinet', 'cabinetry', 'backsplash', 'appliance', 'stove', 'range', 'oven', 'fridge'],
  bathroom: ['bathroom', 'bath', 'ensuite', 'tub', 'soaker', 'shower', 'vanity', 'powder', 'toilet', 'sink'],
  bedroom: ['bedroom', 'bed', 'closet', 'walk', 'primary', 'master', 'nursery'],
  living: ['living', 'fireplace', 'family', 'lounge', 'ceiling', 'ceilings'],
  dining: ['dining', 'table'],
  backyard: ['backyard', 'yard', 'garden', 'patio', 'deck', 'balcony', 'terrace', 'lawn', 'fenced', 'fence', 'tree', 'trees', 'hot', 'pool'],
  view: ['view', 'views', 'mountain', 'ocean', 'water', 'city', 'skyline', 'harbour', 'harbor', 'lake', 'river'],
  exterior: ['exterior', 'facade', 'curb', 'driveway', 'street', 'front', 'aerial'],
  garage: ['garage', 'parking', 'car'],
  basement: ['basement', 'rec', 'theatre', 'theater', 'bar', 'suite'],
  office: ['office', 'den', 'desk', 'study', 'workspace'],
  laundry: ['laundry', 'washer', 'dryer', 'mudroom'],
  amenity: ['gym', 'fitness', 'amenity', 'amenities', 'rooftop', 'concierge', 'clubhouse'],
  entry: ['entry', 'entrance', 'foyer', 'staircase', 'stairs', 'hallway'],
};

// Run through the same tokenizer as queries (lower-case, plurals stemmed).
const roomTerms = Object.fromEntries(
  Object.entries(ROOM_WORDS).map(([room, words]) => [room, tokenize(words.join(' '))]),
) as Partial<Record<Room, string[]>>;

/**
 * The chapter inside a moment's window that best fits the query: a label word
 * match ("Kitchen" for "kitchen island") beats a room-type match, which beats
 * nothing. Returns null when no chapter fits, so the window's own still is kept.
 */
export function chapterFor(chapters: Chapter[] | undefined, start: number, end: number, terms: string[]): Chapter | null {
  if (!chapters?.length || !terms.length) return null;
  const wanted = new Set(terms);
  let best: { c: Chapter; score: number; overlap: number } | null = null;
  for (const c of chapters) {
    const overlap = Math.min(end, c.end) - Math.max(start, c.start);
    if (overlap < 2 || c.room === 'other' || !c.frame) continue;
    const labelHit = tokenize(c.label).some(t => wanted.has(t)) ? 2 : 0;
    const roomHit = (roomTerms[c.room] ?? []).some(w => wanted.has(w)) ? 1 : 0;
    const score = labelHit + roomHit;
    if (score > 0 && (!best || score > best.score || (score === best.score && overlap > best.overlap))) best = { c, score, overlap };
  }
  return best?.c ?? null;
}

/** The room still in a window that best fits the query, from the per-frame scores. */
function bestStill(doc: IndexedSegment, stillScore: Map<string, number>): { chapter: Chapter | null; score: number } {
  let best: { chapter: Chapter | null; score: number } = { chapter: null, score: 0 };
  const seg = doc.segment;
  for (const c of doc.property.chapters ?? []) {
    if (!c.frame || c.room === 'other' || Math.min(seg.end, c.end) - Math.max(seg.start, c.start) < 2) continue;
    const score = stillScore.get(c.frame) ?? 0;
    if (score > best.score) best = { chapter: c, score };
  }
  return best;
}

// Plain room names, for reading which room a caption is about.
const CAPTION_ROOMS: [Room, string[]][] = [
  ['kitchen', ['kitchen', 'kitchenette']],
  ['bathroom', ['bathroom', 'ensuite', 'powder']],
  ['bedroom', ['bedroom', 'nursery']],
  ['living', ['living']],
  ['dining', ['dining']],
  ['office', ['office', 'den', 'study']],
  ['basement', ['basement']],
  ['laundry', ['laundry', 'mudroom']],
  ['garage', ['garage']],
  ['entry', ['entry', 'entryway', 'foyer']],
  ['backyard', ['backyard', 'yard', 'garden', 'patio', 'deck', 'balcony', 'terrace', 'pool']],
];
const captionRoomOf = new Map(CAPTION_ROOMS.flatMap(([room, words]) => tokenize(words.join(' ')).map(w => [w, room] as const)));

/**
 * The room a caption is about: the first room it names ("The basement features
 * a brick fireplace…" is the basement). The window's own room comes from the
 * whole-video chapter pass, which can drift a few seconds off the still and
 * caption, so this wins when they disagree. Null when no room is named.
 */
export function captionRoom(caption: string): Room | null {
  for (const w of tokenize(caption)) {
    const room = captionRoomOf.get(w);
    if (room) return room;
  }
  return null;
}

// Building amenities and views are their own kind of scene; their captions
// mention a pool or a deck without being about a home's rooms.
const roomOf = (seg: Segment): Room =>
  seg.room === 'amenity' || seg.room === 'view' ? seg.room : captionRoom(seg.caption) ?? seg.room;

// The model can split the same query differently from one call to the next,
// so the same search would return different homes. Keep the first answer
// (per instance, which covers a person re-running or sharing a search).
const parseCache = new Map<string, ParsedQuery>();
const PARSE_CACHE_SIZE = 500;
function rememberParse(key: string, parsed: ParsedQuery) {
  if (parseCache.size >= PARSE_CACHE_SIZE) parseCache.delete(parseCache.keys().next().value!);
  parseCache.set(key, parsed);
}

export async function search(query: string): Promise<SearchResponse> {
  const t0 = performance.now();
  const timings: Record<string, number> = {};
  const store = loadStore();
  const apiKey = getApiKey();
  const hybrid = Boolean(apiKey && store.hasVectors);
  const locations = knownLocations(store);

  // 1. Understand the query.
  let parsed: ParsedQuery;
  const parseKey = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const remembered = parseCache.get(parseKey);
  if (remembered) {
    parsed = remembered;
  } else if (apiKey && looksFiltered(query, locations)) {
    try {
      parsed = await parseWithModel(query, locations, apiKey);
      rememberParse(parseKey, parsed);
    } catch {
      parsed = parseWithRules(query, locations);
    }
  } else if (looksFiltered(query, locations)) {
    parsed = parseWithRules(query, locations);
  } else {
    parsed = { semantic: query.trim(), filters: {} };
  }
  timings.parse = Math.round(performance.now() - t0);

  // 2. Embed the descriptive part.
  let qVec: Float32Array | undefined;
  if (hybrid) {
    const t = performance.now();
    qVec = await embed([{ text: queryText(parsed.semantic) }], apiKey!);
    timings.embed = Math.round(performance.now() - t);
  }

  // 3. Score every segment of every property that passes the filters.
  const t2 = performance.now();
  const candidates = store.segments.filter(s => matchesFilters(s.property, parsed.filters));
  const qTerms = tokenize(parsed.semantic);
  const rawKeyword = candidates.map(doc => bm25(store, qTerms, doc));
  const maxKeyword = Math.max(0, ...rawKeyword);

  const stillScore = new Map<string, number>();
  if (qVec) for (const [frame, v] of store.stills) stillScore.set(frame, dot(qVec, v));

  const scored: Scored[] = candidates.map((doc, i) => {
    const visual = qVec && doc.visual ? dot(qVec, doc.visual) : 0;
    const speech = qVec && doc.speech ? dot(qVec, doc.speech) : 0;
    const keyword = maxKeyword > 0 ? rawKeyword[i] / maxKeyword : 0;
    const blended = hybrid ? RANKING.visualWeight * visual + RANKING.speechWeight * speech : keyword;
    const { chapter: stillChapter, score: still } = bestStill(doc, stillScore);
    return { doc, visual, speech, keyword, still, stillChapter, blended, fused: 0 };
  });

  // Reciprocal rank fusion orders results without needing the three signals on one scale.
  // Stills only admit and point at a room (below); they stay out of the order
  // so queries that already worked rank exactly as before.
  const { k, visual: wv, speech: ws, keyword: wk } = RANKING.rrf;
  const rv = rankOf(scored, s => s.visual);
  const rs = rankOf(scored, s => s.speech);
  const rk = rankOf(scored, s => s.keyword);
  for (const s of scored) {
    s.fused = wv / (k + rv.get(s)!) + ws / (k + rs.get(s)!) + wk / (k + rk.get(s)!);
  }

  const floor = hybrid ? RANKING.minBlended : 0.15;
  // A scene that contains every distinctive word of the query ("SkyTrain") is a
  // match even when the embeddings score a short query below the floor.
  const N = store.segments.length || 1;
  const distinctive = [...new Set(qTerms)].filter(t => (store.docFreq.get(t) ?? 0) / N < RANKING.distinctiveDocShare);
  const hasAllWords = (s: Scored) => distinctive.length > 0 && distinctive.every(t => s.doc.terms.has(t));
  // A room still that clearly shows the query ("green couch") is a match even
  // when the 30s clip around it is mostly other rooms.
  const pictured = (s: Scored) => s.still >= RANKING.minStill;
  const relevant = scored.filter(s => s.blended >= floor || (hybrid && (hasAllWords(s) || pictured(s))));

  // 4. Group by property, keep the best few non-overlapping moments each.
  const toMatches = (pool: Scored[]): PropertyMatch[] => {
    const groups = new Map<string, Scored[]>();
    for (const s of pool) {
      const list = groups.get(s.doc.property.id) ?? [];
      list.push(s);
      groups.set(s.doc.property.id, list);
    }
    const maxFused = Math.max(1e-9, ...pool.map(s => s.fused));
    return [...groups.values()].map(list => {
      list.sort((a, b) => b.fused - a.fused);
      const moments: Moment[] = [];
      const windows: { start: number; end: number }[] = [];
      const frames = new Set<string>();
      for (const s of list) {
        const seg = s.doc.segment;
        if (windows.some(w => overlaps(w, seg))) continue;
        // Show, label and start at the room in this window that fits the query:
        // the one whose still shows it, else the one whose name says it.
        const chapter = (pictured(s) ? s.stillChapter : null) ?? chapterFor(s.doc.property.chapters, seg.start, seg.end, qTerms);
        // Two windows can land on the same room chapter; show it once.
        const frame = chapter?.frame ?? seg.frame;
        if (frame && frames.has(frame)) continue;
        if (frame) frames.add(frame);
        windows.push(seg);
        moments.push({
          segmentId: seg.id,
          start: chapter ? Math.max(seg.start, chapter.start) : seg.start,
          end: seg.end,
          room: chapter?.room ?? roomOf(seg),
          label: chapter?.label,
          caption: seg.caption,
          transcript: seg.transcript,
          frame,
          score: +(s.fused / maxFused).toFixed(3),
          signals: { visual: +s.visual.toFixed(3), speech: +s.speech.toFixed(3), keyword: +s.keyword.toFixed(3), still: +s.still.toFixed(3) },
          ...(pictured(s) && s.stillChapter ? { pictured: true } : {}),
        });
        if (moments.length >= RANKING.maxMomentsPerProperty) break;
      }
      return { property: withoutSegments(list[0].doc.property), score: moments[0].score, moments };
    });
  };

  let matches = toMatches(relevant);
  let closest = false;
  const hasFilters = Object.keys(parsed.filters).length > 0;
  // The parser returns this neutral phrase when nothing descriptive is left.
  const descriptive = parsed.semantic.trim().toLowerCase() !== 'house tour';

  if (!matches.length && hasFilters && descriptive && hybrid && scored.length) {
    // Homes pass the filters but none clearly shows what was asked for. Show the
    // nearest real moments, flagged, rather than nothing or unrelated scenes.
    matches = toMatches(scored).sort((a, b) => b.score - a.score).slice(0, RANKING.closestProperties);
    closest = true;
  } else if (!matches.length && hasFilters) {
    // A filters-only query ("3 bed in Burnaby") has nothing descriptive to rank by.
    const seen = new Set<string>();
    for (const c of candidates) {
      if (seen.has(c.property.id)) continue;
      seen.add(c.property.id);
      const seg = c.property.segments[0];
      matches.push({
        property: withoutSegments(c.property),
        score: 1,
        moments: seg
          ? [{ segmentId: seg.id, start: seg.start, end: seg.end, room: seg.room, caption: seg.caption, transcript: seg.transcript, frame: seg.frame, score: 1, signals: { visual: 0, speech: 0, keyword: 0 } }]
          : [],
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  const top = matches[0]?.score ?? 0;
  if (!closest) matches = matches.filter(m => m.score >= top * RANKING.relativeCutoff).slice(0, RANKING.maxProperties);
  timings.rank = Math.round(performance.now() - t2);
  timings.total = Math.round(performance.now() - t0);

  return {
    query,
    interpreted: parsed,
    mode: hybrid ? 'hybrid' : 'keyword',
    matches,
    ...(closest ? { closest: true } : {}),
    stats: {
      segmentsSearched: candidates.length,
      propertiesConsidered: new Set(candidates.map(c => c.property.id)).size,
      timings,
    },
  };
}
