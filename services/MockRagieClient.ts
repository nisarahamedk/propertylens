
import { IRagieClient } from './interfaces';
import { RagieDocument, RagieRetrievalRequest, RagieRetrievalResponse, RagieGenerateRequest, RagieGenerateResponse } from './ragieTypes';
import { MOCK_PROPERTIES, MOCK_VIDEO_DATA, generateMockResults } from './mockData';
import { Property } from '../types';

export class MockRagieClient implements IRagieClient {
  // In-memory store for the session
  private _properties: Property[] = [...MOCK_PROPERTIES];

  documents = {
    list: async (options?: { page_size?: number; filter?: string }) => {
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // In a real mock, we might implement filtering, but for now we just return the list
      // mimicking the page_size limit if provided
      let results = this._properties.map(p => ({
        id: p.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'ready' as const,
        name: p.name,
        metadata: {
          title: p.name,
          address: p.address,
          beds: p.beds,
          baths: p.baths,
          sqft: p.sqft,
          thumbnailUrl: p.thumbnailUrl,
          description: p.description,
          videoUrl: p.videoUrl,
          youtubeId: p.youtubeId,
          transcripts: MOCK_VIDEO_DATA[p.id]?.transcripts || [],
          moments: MOCK_VIDEO_DATA[p.id]?.moments || []
        }
      }));

      if (options?.page_size) {
        results = results.slice(0, options.page_size);
      }

      return results;
    },

    get: async (id: string) => {
      await new Promise(resolve => setTimeout(resolve, 300));
      const prop = this._properties.find(p => p.id === id);
      if (!prop) throw new Error("Document not found");

      return {
        id: prop.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'ready' as const,
        name: prop.name,
        metadata: {
          title: prop.name,
          address: prop.address,
          beds: prop.beds,
          baths: prop.baths,
          sqft: prop.sqft,
          thumbnailUrl: prop.thumbnailUrl,
          description: prop.description,
          videoUrl: prop.videoUrl,
          youtubeId: prop.youtubeId,
          transcripts: MOCK_VIDEO_DATA[prop.id]?.transcripts || [],
          moments: MOCK_VIDEO_DATA[prop.id]?.moments || []
        }
      };
    },

    create: async (file: File, metadata?: Record<string, any>) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newId = `new_${Date.now()}`;
      const newProp: Property = {
        id: newId,
        name: file.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' '),
        address: (metadata?.address as string) || "New Upload",
        beds: 0,
        baths: 0,
        sqft: 0,
        thumbnailUrl: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=800&q=80",
        description: "Newly indexed content",
        videoUrl: undefined
      };
      
      this._properties.unshift(newProp);
      
      return {
        id: newId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'processing' as const, // Mimic async processing
        name: newProp.name,
        metadata: metadata || {}
      };
    },

    delete: async (id: string) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      this._properties = this._properties.filter(p => p.id !== id);
    }
  };

  retrievals = {
    retrieve: async (request: RagieRetrievalRequest): Promise<RagieRetrievalResponse> => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const results = generateMockResults(request.query);

      const scored_chunks = results.map(r => ({
        id: r.id,
        text: r.transcriptSnippet,
        score: 0.85,
        document_id: r.property.id,
        document_name: r.property.name,
        document_metadata: {
            title: r.property.name,
            address: r.property.address,
            thumbnailUrl: r.property.thumbnailUrl,
            youtubeId: r.property.youtubeId,
            videoUrl: r.property.videoUrl
        },
        metadata: {
            start: r.timestampSeconds,
            image: r.thumbnailUrl,
            visual_reasoning: r.visualMatchReason 
        }
      }));

      return { scored_chunks };
    }
  };

  generations = {
    generate: async (request: RagieGenerateRequest): Promise<RagieGenerateResponse> => {
       await new Promise(resolve => setTimeout(resolve, 1500));
       
       const q = request.query.toLowerCase();
       let text = "Based on the provided context, I couldn't find a specific answer to your question.";

       if (q.includes("pool")) text = "The property does not appear to have a pool based on the video analysis. The focus is primarily on the living areas and kitchen.";
       else if (q.includes("kitchen") || q.includes("cook")) text = "The kitchen features modern appliances, a large island, and custom cabinetry. It appears to be a central gathering point in the home.";
       else if (q.includes("bed") || q.includes("sleep") || q.includes("room")) text = "The bedrooms shown are spacious with ample natural light, neutral color palettes, and hardwood flooring.";
       else if (q.includes("yard") || q.includes("garden") || q.includes("outside")) text = "The outdoor space includes mature landscaping and a patio area perfect for entertaining.";
       else if (q.includes("price") || q.includes("cost")) text = "The provided context does not contain pricing information for this property.";

       return {
         text: text,
         usage: { prompt_tokens: 50, completion_tokens: 20 }
       };
    }
  }
}
