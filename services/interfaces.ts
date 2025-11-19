
import { RagieDocument, RagieRetrievalRequest, RagieRetrievalResponse, RagieGenerateRequest, RagieGenerateResponse, RagieListResponse } from './ragieTypes';
import { Property, SearchResult, VideoData } from '../types';

export interface IRagieClient {
  documents: {
    list: (options?: { page_size?: number; filter?: string; cursor?: string }) => Promise<RagieListResponse>;
    get: (id: string) => Promise<RagieDocument>;
    create: (file: File, metadata?: Record<string, any>) => Promise<RagieDocument>;
    delete: (id: string) => Promise<void>;
  };
  retrievals: {
    retrieve: (request: RagieRetrievalRequest) => Promise<RagieRetrievalResponse>;
  };
  generations: {
    generate: (request: RagieGenerateRequest) => Promise<RagieGenerateResponse>;
  };
}

export interface ISearchService {
  getRecentProperties(): Promise<Property[]>;
  searchProperties(query: string): Promise<SearchResult[]>;
  getPropertyDetails(id: string): Promise<VideoData | null>;
  generateGroundedResponse(query: string, context: string): Promise<string>;
}
