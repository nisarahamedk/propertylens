
export interface Property {
  id: string;
  name: string;
  address: string;
  beds: number;
  baths: number;
  sqft: number;
  thumbnailUrl: string;
  videoUrl?: string;
  youtubeId?: string;
  description: string;
  ragieId?: string;
}

export interface TranscriptLine {
  timestamp: string;
  timestampSeconds: number;
  text: string;
}

export interface SearchResult {
  id: string;
  property: Property;
  timestamp: string;
  timestampSeconds: number;
  duration: string;
  durationSeconds: number;
  score: number;
  transcriptSnippet: string;
  visualMatchReason: string;
  thumbnailUrl: string;
  streamUrl?: string;
}

export interface VideoData {
  propertyId: string;
  transcripts: TranscriptLine[];
  moments: {
    id: string;
    label: string;
    timestamp: string;
    timestampSeconds: number;
  }[];
}
