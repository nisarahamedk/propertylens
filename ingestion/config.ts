import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  // Directories
  VIDEOS_DIR: path.join(__dirname, 'videos'),
  MANIFEST_PATH: path.join(__dirname, 'manifest.json'),

  // Search parameters
  SEARCH_QUERY: 'real estate agent house tour walkthrough Vancouver BC',
  MIN_DURATION_SECONDS: 60, // 1 minute minimum
  MAX_DURATION_SECONDS: 300, // 5 minutes
  TARGET_VIDEO_COUNT: 10,

  // Ragie
  RAGIE_API_KEY: process.env.RAGIE_API_KEY || '',
  RAGIE_API_URL: 'https://api.ragie.ai',
};

export interface VideoManifestEntry {
  youtubeId: string;
  title: string;
  description: string;
  channelName: string;
  duration: number; // seconds
  thumbnailUrl: string;
  localPath?: string;
  ragieDocumentId?: string;
  // Parsed metadata
  metadata: {
    location?: string;
    address?: string;
    beds?: number;
    baths?: number;
    sqft?: number;
    price?: string;
  };
}

export interface VideoManifest {
  videos: VideoManifestEntry[];
  lastUpdated: string;
}
