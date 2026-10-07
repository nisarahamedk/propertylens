// Shared between the React app, the API handlers and the ingestion script.

export type Room =
  | 'exterior'
  | 'entry'
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'office'
  | 'basement'
  | 'laundry'
  | 'garage'
  | 'backyard'
  | 'view'
  | 'amenity'
  | 'other';

/** One ~30s window of a tour video, as produced by ingestion/build-index.ts. */
export interface Segment {
  id: string;            // `${youtubeId}:${start padded to 4}`
  start: number;         // seconds
  end: number;           // seconds
  room: Room;            // the room the window mostly shows
  rooms?: string[];      // chapter labels the window passes through, in order
  caption: string;       // what is visible
  features: string[];    // short noun phrases, e.g. "quartz island"
  transcript: string;    // what is said
  frame?: string;        // public path of a still from the window's main room
}

/** One continuous room or area in the tour, as Gemini timed it from the whole video. */
export interface Chapter {
  start: number;         // seconds
  end: number;           // seconds
  room: Room;
  label: string;         // e.g. "Ensuite", "Walk-in closet"
  frame?: string;        // public path of a still from the middle of the chapter
}

export interface Property {
  id: string;            // youtubeId
  youtubeId: string;
  name: string;
  address: string;
  location: string;
  beds: number;
  baths: number;
  sqft: number;
  price?: string;        // as listed, e.g. "$4,250,000"
  priceValue?: number;   // parsed, for filtering
  thumbnailUrl: string;
  description: string;
  channelName: string;
  duration: number;      // seconds
  summary?: string;      // generated from the segment captions
  highlights?: string[];
  chapters?: Chapter[];  // room-by-room timeline; segments are fixed 30s search windows
  segments: Segment[];
}

export interface Catalog {
  generatedAt: string;
  models?: { embedding: string; describe: string; dims: number };
  properties: Property[];
}

export interface SearchFilters {
  minBeds?: number;
  minBaths?: number;
  minSqft?: number;
  minPrice?: number;
  maxPrice?: number;
  locations?: string[];
}

export interface MomentSignals {
  visual: number;   // cosine(query, clip embedding)
  speech: number;   // cosine(query, caption + transcript embedding)
  keyword: number;  // normalised BM25 over caption + transcript, 0..1
  still?: number;   // cosine(query, the best room still in the window)
}

export interface Moment {
  segmentId: string;
  start: number;
  end: number;
  room: Room;
  label?: string;   // the chapter shown for this moment, e.g. "Kitchen"
  caption: string;
  transcript: string;
  frame?: string;
  score: number;    // 0..1, comparable within one response
  signals: MomentSignals;
  pictured?: boolean; // the room's still clearly shows the search, so `frame` is the proof
}

export interface PropertyMatch {
  property: Omit<Property, 'segments'>;
  score: number;
  moments: Moment[];
}

export interface SearchResponse {
  query: string;
  interpreted: { semantic: string; filters: SearchFilters };
  mode: 'hybrid' | 'keyword';
  matches: PropertyMatch[];
  closest?: boolean;     // no home passing the filters clearly matched; these are the nearest moments
  stats: {
    segmentsSearched: number;
    propertiesConsidered: number;
    timings: Record<string, number>; // ms
  };
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatRequest {
  youtubeId: string;
  question: string;
  currentTime?: number;
  history?: ChatTurn[];
}
