
import { IRagieClient } from './interfaces';
import { MockRagieClient } from './MockRagieClient';
import { RealRagieClient } from './RealRagieClient';
import { Property, SearchResult, VideoData } from '../types';

// CONFIGURATION
const USE_MOCK_DATA = false;
const RAGIE_API_KEY = process.env.RAGIE_API_KEY || "";

class SearchService {
  private client: IRagieClient;

  constructor() {
    // Dependency Injection Point
    if (USE_MOCK_DATA) {
      this.client = new MockRagieClient();
      console.log("[System] Initialized with MOCK Ragie Client");
    } else {
      this.client = new RealRagieClient(RAGIE_API_KEY);
      console.log("[System] Initialized with REAL Ragie Client");
    }
  }

  // Application Logic: Map API -> App Domain
  async getRecentProperties(): Promise<Property[]> {
    const docs = await this.client.documents.list({ page_size: 8 });
    
    return docs.map(doc => {
      const meta = doc.metadata || {};
      return {
        id: doc.id,
        ragieId: doc.id,
        name: (meta.location || meta.title || doc.name || "Untitled").replace(/_/g, ' '),
        address: meta.address || meta.location || doc.name?.replace(/_/g, ' ') || "",
        beds: meta.bed || meta.beds || 0,
        baths: meta.bath || meta.baths || 0,
        sqft: meta.sqft || 0,
        thumbnailUrl: meta.thumbnailUrl || "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
        description: meta.description || "Indexed content.",
        videoUrl: meta.videoUrl,
        youtubeId: meta.youtubeId
      };
    });
  }

  async searchProperties(query: string): Promise<SearchResult[]> {
    const retrieval = await this.client.retrievals.retrieve({
      query: query,
      top_k: 3,
      max_chunks_per_document: 1
    });

    return retrieval.scored_chunks.map(chunk => {
      const meta = chunk.document_metadata || chunk.metadata || {};
      const chunkMeta = chunk.metadata || {};
      
      // Reconstruct Property object from chunk metadata
      const property: Property = {
        id: chunk.document_id,
        name: (meta.location || chunk.document_name || "Unknown").replace(/_/g, ' '),
        address: meta.address || meta.location || chunk.document_name?.replace(/_/g, ' ') || "",
        beds: meta.bed || meta.beds || 0,
        baths: meta.bath || meta.baths || 0,
        sqft: meta.sqft || 0,
        thumbnailUrl: meta.thumbnailUrl || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
        description: meta.description || "",
        videoUrl: meta.videoUrl,
        youtubeId: meta.youtubeId
      };

      const seconds = chunkMeta.start || chunkMeta.start_time || 0;
      const endSeconds = chunkMeta.end || chunkMeta.end_time || seconds;
      const durationSeconds = Math.max(0, endSeconds - seconds);

      // Use chunk-specific video URL for efficient streaming (requires partition header)
      const links = (chunk as any).links || {};
      const videoLink = links.self_video_stream || links.self_audio_stream;
      let streamUrl = videoLink?.href;

      // Convert absolute Ragie URLs to proxy path
      if (streamUrl && typeof streamUrl === 'string' && streamUrl.includes('api.ragie.ai')) {
        streamUrl = streamUrl.replace('https://api.ragie.ai', '/api/ragie');
      }

      // No fallback - chunk streams are required
      if (!streamUrl) {
        console.error('[Search] No chunk stream URL for:', chunk.id);
      }

      console.log('[Search] Chunk:', chunk.id, 'Timestamp:', seconds, 'StreamUrl:', streamUrl);

      return {
        id: chunk.id,
        property,
        timestamp: this.formatTime(seconds),
        timestampSeconds: seconds,
        duration: this.formatDuration(durationSeconds),
        durationSeconds,
        score: chunk.score,
        transcriptSnippet: this.parseSnippet(chunk.text),
        visualMatchReason: chunkMeta.visual_reasoning || `Semantic Match (${Math.round(chunk.score * 100)}%)`,
        thumbnailUrl: property.thumbnailUrl,
        streamUrl,
        selfText: chunk.text
      };
    });
  }

  async getPropertyDetails(id: string): Promise<VideoData | null> {
    // In a real scenario, this might require a specific endpoint or parsing the document metadata
    try {
      const doc = await this.client.documents.get(id);
      const meta = doc.metadata || {};
      
      return {
        propertyId: doc.id,
        transcripts: meta.transcripts || [],
        moments: meta.moments || []
      };
    } catch (e) {
      console.warn("Could not fetch detailed video data", e);
      return null;
    }
  }

  async generateGroundedResponse(query: string, context: string): Promise<string> {
    try {
      const response = await this.client.generations.generate({
        query,
        context: [context],
        system_instruction: "You are a helpful real estate assistant. Answer the user's question based ONLY on the provided transcript context and property details. If the answer is not in the context, kindly state that you don't have that information."
      });
      return response.text;
    } catch (e) {
      console.error("Generation failed", e);
      return "I'm sorry, I couldn't generate a response at this time.";
    }
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private formatDuration(seconds: number): string {
    const s = Math.round(seconds);
    return `${s}s`;
  }

  private parseSnippet(text: string): string {
    // Clean up JSON strings if the model output JSON
    if (text.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(text);
        return parsed.video_description || parsed.text || text;
      } catch (e) { return text; }
    }
    return text;
  }
}

// Singleton export
const searchService = new SearchService();

export const getRecentProperties = () => searchService.getRecentProperties();
export const searchProperties = (query: string) => searchService.searchProperties(query);
export const getPropertyDetails = (id: string) => searchService.getPropertyDetails(id);
export const generateGroundedResponse = (query: string, context: string) => searchService.generateGroundedResponse(query, context);
