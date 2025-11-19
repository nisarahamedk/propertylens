
import { IRagieClient } from './interfaces';
import { RagieDocument, RagieRetrievalRequest, RagieRetrievalResponse, RagieGenerateRequest, RagieGenerateResponse } from './ragieTypes';

const RAGIE_API_BASE = "https://api.ragie.ai";

const fetchWithCors = async (url: string, options: RequestInit) => {
  try {
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    console.warn("Direct fetch failed, attempting proxy.", error);
    return fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, options);
  }
};

export class RealRagieClient implements IRagieClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private get headers() {
    return {
      'accept': 'application/json',
      'authorization': `Bearer ${this.apiKey}`
    };
  }

  private get jsonHeaders() {
    return {
      ...this.headers,
      'content-type': 'application/json'
    };
  }

  documents = {
    list: async (options?: { page_size?: number; filter?: string }) => {
      const url = new URL(`${RAGIE_API_BASE}/documents`);
      if (options?.page_size) url.searchParams.append('page_size', options.page_size.toString());
      if (options?.filter) url.searchParams.append('filter', options.filter);

      const response = await fetchWithCors(url.toString(), {
        method: 'GET',
        headers: this.jsonHeaders
      });

      if (!response.ok) throw new Error(`Ragie API Error: ${response.statusText}`);
      const data = await response.json();
      return data.results || []; 
    },

    get: async (id: string) => {
        const response = await fetchWithCors(`${RAGIE_API_BASE}/documents/${id}`, {
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
      const response = await fetchWithCors(`${RAGIE_API_BASE}/documents`, {
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
      const response = await fetchWithCors(`${RAGIE_API_BASE}/documents/${id}`, {
        method: 'DELETE',
        headers: this.headers
      });
      if (!response.ok) throw new Error(`Delete Failed: ${response.statusText}`);
    }
  };

  retrievals = {
    retrieve: async (request: RagieRetrievalRequest): Promise<RagieRetrievalResponse> => {
      const response = await fetchWithCors(`${RAGIE_API_BASE}/retrievals`, {
        method: 'POST',
        headers: this.jsonHeaders,
        body: JSON.stringify(request)
      });

      if (!response.ok) throw new Error(`Ragie Search Error: ${response.statusText}`);
      return await response.json();
    }
  };

  generations = {
    generate: async (request: RagieGenerateRequest): Promise<RagieGenerateResponse> => {
      const response = await fetchWithCors(`${RAGIE_API_BASE}/generations`, {
         method: 'POST',
         headers: this.jsonHeaders,
         body: JSON.stringify(request)
      });

      if (!response.ok) {
          // Fallback for now if endpoint doesn't exist in all environments
          if (response.status === 404) {
              return { text: "Generation endpoint not available in this environment." };
          }
          throw new Error(`Generation Error: ${response.statusText}`);
      }
      return await response.json();
    }
  }
}
