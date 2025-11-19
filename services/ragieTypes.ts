
export interface RagieDocument {
  id: string;
  created_at: string;
  updated_at: string;
  status: 'pending' | 'partitioning' | 'partitioned' | 'refined' | 'chunked' | 'indexed' | 'summary_indexed' | 'keyword_indexed' | 'ready' | 'failed';
  name: string;
  metadata: Record<string, any>;
  chunk_count?: number;
  external_id?: string;
}

export interface ScoredChunk {
  id: string;
  text: string;
  score: number;
  document_id: string;
  document_name: string;
  document_metadata: Record<string, any>;
  metadata: Record<string, any>;
}

export interface RagieRetrievalResponse {
  scored_chunks: ScoredChunk[];
}

export interface RagieRetrievalRequest {
  query: string;
  top_k?: number;
  filter?: Record<string, any>;
  partition?: string;
  rerank?: boolean;
  max_chunks_per_document?: number;
}

export interface RagieGenerateRequest {
  query: string;
  context?: string[];
  system_instruction?: string;
}

export interface RagieGenerateResponse {
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface RagieListResponse {
  results: RagieDocument[];
  pagination?: {
    next_cursor?: string;
    total?: number;
  };
}
