
import { ISearchService } from './interfaces';
import { Property, SearchResult, VideoData } from '../types';
import { MOCK_PROPERTIES, MOCK_VIDEO_DATA, generateMockResults } from './mockData';

export class MockSearchService implements ISearchService {
  async getRecentProperties(): Promise<Property[]> {
    // Simulate network delay for realism
    await new Promise(resolve => setTimeout(resolve, 800));
    return MOCK_PROPERTIES;
  }

  async searchProperties(query: string): Promise<SearchResult[]> {
    await new Promise(resolve => setTimeout(resolve, 1200));
    return generateMockResults(query);
  }

  async getPropertyDetails(id: string): Promise<VideoData | null> {
    await new Promise(resolve => setTimeout(resolve, 600));
    return MOCK_VIDEO_DATA[id] || null;
  }

  async generateGroundedResponse(query: string, context: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return "This is a mock response derived from the video transcript. (MockSearchService)";
  }
}
