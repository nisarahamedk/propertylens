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
  room: Room;
  caption: string;       // what is visible
  features: string[];    // short noun phrases, e.g. "quartz island"
  transcript: string;    // what is said
  frame?: string;        // public path of a still from the middle of the window
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
}

export interface Moment {
  segmentId: string;
  start: number;
  end: number;
  room: Room;
  caption: string;
  transcript: string;
  frame?: string;
  score: number;    // 0..1, comparable within one response
  signals: MomentSignals;
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
