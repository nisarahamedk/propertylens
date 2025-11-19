
import { IRagieClient } from './interfaces';
import { RagieDocument, RagieRetrievalRequest, RagieRetrievalResponse, RagieGenerateRequest, RagieGenerateResponse, RagieListResponse } from './ragieTypes';

// Use Vite proxy in development, direct URL in production
const RAGIE_API_BASE = "/api/ragie";

export class RealRagieClient implements IRagieClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers() {
    return {
      'accept': 'application/json',
      'authorization': `Bearer ${this.apiKey}`,
      'partition': 'default'  // Required for chunk content access
    };
  }

  private get jsonHeaders() {
    return {
      ...this.headers,
      'content-type': 'application/json'
    };
  }

  documents = {
    list: async (options?: { page_size?: number; filter?: string; cursor?: string }): Promise<RagieListResponse> => {
      let url = `${RAGIE_API_BASE}/documents`;
      const params = new URLSearchParams();
      if (options?.page_size) params.append('page_size', options.page_size.toString());
      if (options?.filter) params.append('filter', options.filter);
      if (options?.cursor) params.append('cursor', options.cursor);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.jsonHeaders
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('Invalid API key. Please check your RAGIE_API_KEY.');
        if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
        throw new Error(`Ragie API Error: ${response.status} - ${response.statusText}`);
      }
      const data = await response.json();
      return {
        results: data.documents || data.results || [],
        pagination: {
          next_cursor: data.pagination?.next_cursor,
          total: data.pagination?.total_count
        }
      };
    },

    get: async (id: string) => {
        const response = await fetch(`${RAGIE_API_BASE}/documents/${id}`, {
            method: 'GET',
            headers: this.jsonHeaders
        });
        if (!response.ok) throw new Error(`Ragie API Error: ${response.statusText}`);
        return await response.json();
    },

    create: async (file: File, metadata?: Record<string, any>) => {
      const formData = new FormData();
      formData.append('file', file);
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
      }

      // Note: multipart/form-data boundary is handled automatically by fetch if Content-Type is NOT set manually
      const response = await fetch(`${RAGIE_API_BASE}/documents`, {
        method: 'POST',
        headers: this.headers, // Do not set Content-Type to json here
        body: formData
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Upload Failed: ${txt}`);
      }
      return await response.json();
    },

    delete: async (id: string) => {
      const response = await fetch(`${RAGIE_API_BASE}/documents/${id}`, {
        method: 'DELETE',
        headers: this.headers
      });
      if (!response.ok) throw new Error(`Delete Failed: ${response.statusText}`);
    }
  };

  retrievals = {
    retrieve: async (request: RagieRetrievalRequest): Promise<RagieRetrievalResponse> => {
      const response = await fetch(`${RAGIE_API_BASE}/retrievals`, {
        method: 'POST',
        headers: this.jsonHeaders,
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error('Invalid API key. Please check your RAGIE_API_KEY.');
        if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
        const errorText = await response.text();
        throw new Error(`Ragie Search Error: ${response.status} - ${errorText}`);
      }
      return await response.json();
    }
  };

  generations = {
    generate: async (request: RagieGenerateRequest): Promise<RagieGenerateResponse> => {
      // Use the /responses endpoint with deep-search model
      const requestBody = {
        query: request.query,
        model: "deep-search",
        stream: false
      };

      const response = await fetch(`${RAGIE_API_BASE}/responses`, {
         method: 'POST',
         headers: this.jsonHeaders,
         body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
          if (response.status === 404) {
              return { text: "Response generation endpoint not available." };
          }
          if (response.status === 429) {
              return { text: "Rate limit exceeded. Please try again later." };
          }
          const errorText = await response.text();
          throw new Error(`Generation Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return { text: data.output || data.text || "No response generated." };
    }
  }
}
