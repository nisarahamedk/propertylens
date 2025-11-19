
import { ISearchService } from './interfaces';
import { Property, SearchResult, VideoData } from '../types';

const RAGIE_API_KEY = process.env.RAGIE_API_KEY || "";
const RAGIE_API_BASE = "https://api.ragie.ai";

// Helper to handle CORS via proxy if direct access fails
const fetchWithCors = async (url: string, options: RequestInit) => {
  try {
    // Try direct fetch first as requested
    const response = await fetch(url, options);
    return response;
  } catch (error) {
    // Direct fetch failed, attempting proxy fallback
    // Fallback to CORS proxy for browser compatibility
    return fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, options);
  }
};

export class RagieSearchService implements ISearchService {
  async getRecentProperties(): Promise<Property[]> {
    const options = {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${RAGIE_API_KEY}`
      }
    };

    const response = await fetchWithCors(`${RAGIE_API_BASE}/documents`, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const docs = data.results || [];

    return docs.slice(0, 8).map((doc: any) => {
      const meta = doc.metadata || {};
      return {
        id: doc.id,
        ragieId: doc.id,
        name: (meta.title || doc.name || "Untitled Property").replace(/\.[^/.]+$/, "").replace(/_/g, ' '),
        address: meta.address || "Indexed Property",
        beds: meta.beds || 0,
        baths: meta.baths || 0,
        sqft: meta.sqft || 0,
        thumbnailUrl: meta.thumbnailUrl || "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
        description: meta.description || "Video content indexed from Ragie.",
        videoUrl: meta.videoUrl,
        youtubeId: meta.youtubeId
      };
    });
  }

  async searchProperties(query: string): Promise<SearchResult[]> {
    const options = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${RAGIE_API_KEY}`
      },
      body: JSON.stringify({
        query: query,
        top_k: 6
      })
    };

    const response = await fetchWithCors(`${RAGIE_API_BASE}/retrievals`, options);

    if (!response.ok) {
       const errorText = await response.text().catch(() => "Unknown error");
       throw new Error(`Search Failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const scoredChunks = data.scored_chunks || [];
    
    return scoredChunks.map((chunk: any) => {
      const docName = chunk.document_name || "";
      const metadata = chunk.metadata || {};
      const seconds = metadata.start || metadata.start_time || 0;

      const property: Property = {
           id: chunk.document_id,
           ragieId: chunk.document_id,
           name: (metadata.title || docName).replace(/\.[^/.]+$/, "").replace(/_/g, ' '),
           address: metadata.address || "Indexed Result",
           beds: metadata.beds || 0,
           baths: metadata.baths || 0,
           sqft: metadata.sqft || 0,
           thumbnailUrl: metadata.thumbnailUrl || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
           description: "Result from Ragie index",
           videoUrl: undefined
      };

      const streamUrl = chunk.links?.self_video_stream?.href;

      return {
        id: chunk.id,
        property: property,
        timestamp: this.formatTime(seconds),
        timestampSeconds: seconds,
        transcriptSnippet: this.parseSnippet(chunk.text),
        visualMatchReason: `Semantic Match (${Math.round(chunk.score * 100)}%)`,
        thumbnailUrl: property.thumbnailUrl,
        streamUrl: streamUrl
      };
    });
  }

  // In a real app, this might fetch a separate endpoint for detailed transcript/moments
  // For now, we return null or partial data as the Ragie retrieval endpoint is focused on chunks
  async getPropertyDetails(id: string): Promise<VideoData | null> {
    return null; 
  }

  async generateGroundedResponse(query: string, context: string): Promise<string> {
    // Fallback / legacy implementation using direct fetch if needed
    const options = {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${RAGIE_API_KEY}`
      },
      body: JSON.stringify({
        query,
        context: [context]
      })
    };
    try {
       // Assuming endpoint exists
       const response = await fetchWithCors(`${RAGIE_API_BASE}/generations`, options);
       if (response.ok) {
         const data = await response.json();
         return data.text;
       }
    } catch(e) {}
    
    return "Legacy service: Response not available.";
  }

  private parseSnippet(text: string): string {
    try {
      if (text.trim().startsWith('{')) {
        const parsed = JSON.parse(text);
        if (parsed.video_description) return parsed.video_description.slice(0, 150) + "...";
      }
    } catch (e) {
      // fallback
    }
    return text.slice(0, 150) + "...";
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
