
export interface RagieDocument {
  id: string;
  created_at: string;
  updated_at: string;
  status: 'ready' | 'processing' | 'failed';
  name: string;
  metadata: Record<string, any>;
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
  filter?: string;
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
