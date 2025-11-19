/**
 * YouTube Search Scraper
 * Scrapes YouTube search results for house tour videos in BC
 *
 * Usage: npx ts-node ingestion/youtube-search.ts
 */

import fs from 'fs';
import { CONFIG, VideoManifest, VideoManifestEntry } from './config';

interface YouTubeVideoData {
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  lengthSeconds: number;
  thumbnailUrl: string;
}

async function searchYouTube(query: string): Promise<YouTubeVideoData[]> {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIYAQ%3D%3D`; // sp filter for < 4 minutes

  console.log(`Searching YouTube for: "${query}"`);
  console.log(`URL: ${searchUrl}\n`);

  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube search failed: ${response.status}`);
  }

  const html = await response.text();

  // Extract the initial data JSON from the page
  const ytInitialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s);
  if (!ytInitialDataMatch) {
    throw new Error('Could not find ytInitialData in YouTube response');
  }

  const ytData = JSON.parse(ytInitialDataMatch[1]);
  const videos: YouTubeVideoData[] = [];

  // Navigate the YouTube data structure to find video results
  const contents = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;

  if (!contents) {
    throw new Error('Unexpected YouTube data structure');
  }

  for (const section of contents) {
    const items = section?.itemSectionRenderer?.contents || [];

    for (const item of items) {
      const videoRenderer = item?.videoRenderer;
      if (!videoRenderer) continue;

      const videoId = videoRenderer.videoId;
      const title = videoRenderer.title?.runs?.[0]?.text || '';
      const description = videoRenderer.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join('') ||
                         videoRenderer.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || '';
      const channelName = videoRenderer.ownerText?.runs?.[0]?.text || '';
      const thumbnailUrl = videoRenderer.thumbnail?.thumbnails?.slice(-1)[0]?.url || '';

      // Parse duration (format: "4:32" or "12:45")
      const durationText = videoRenderer.lengthText?.simpleText || '0:00';
      const durationParts = durationText.split(':').map(Number);
      let lengthSeconds = 0;
      if (durationParts.length === 2) {
        lengthSeconds = durationParts[0] * 60 + durationParts[1];
      } else if (durationParts.length === 3) {
        lengthSeconds = durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2];
      }

      // Filter by duration (min and max)
      const minDuration = (CONFIG as any).MIN_DURATION_SECONDS || 0;
      if (lengthSeconds >= minDuration && lengthSeconds <= CONFIG.MAX_DURATION_SECONDS) {
        videos.push({
          videoId,
          title,
          description,
          channelName,
          lengthSeconds,
          thumbnailUrl,
        });
      }
    }
  }

  return videos;
}

function parseMetadataFromTitle(title: string, description: string): VideoManifestEntry['metadata'] {
  const combined = `${title} ${description}`.toLowerCase();
  const metadata: VideoManifestEntry['metadata'] = {};

  // Extract location (city names in BC)
  const bcCities = ['vancouver', 'burnaby', 'richmond', 'surrey', 'coquitlam', 'langley', 'abbotsford', 'kelowna', 'victoria', 'nanaimo', 'kamloops', 'white rock', 'north vancouver', 'west vancouver', 'new westminster', 'delta', 'maple ridge', 'port coquitlam', 'chilliwack'];
  for (const city of bcCities) {
    if (combined.includes(city)) {
      metadata.location = city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    }
  }

  // Extract beds
  const bedsMatch = combined.match(/(\d+)\s*(?:bed|bedroom|br|bd)/);
  if (bedsMatch) {
    metadata.beds = parseInt(bedsMatch[1]);
  }

  // Extract baths
  const bathsMatch = combined.match(/(\d+(?:\.\d+)?)\s*(?:bath|bathroom|ba)/);
  if (bathsMatch) {
    metadata.baths = parseFloat(bathsMatch[1]);
  }

  // Extract sqft
  const sqftMatch = combined.match(/(\d{1,3}(?:,\d{3})*|\d+)\s*(?:sq\s*ft|sqft|square\s*feet|sf)/);
  if (sqftMatch) {
    metadata.sqft = parseInt(sqftMatch[1].replace(/,/g, ''));
  }

  // Extract price
  const priceMatch = combined.match(/\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d+)?)\s*(?:m|k)?/i);
  if (priceMatch) {
    metadata.price = priceMatch[0];
  }

  // Extract address (look for street patterns)
  const addressMatch = title.match(/(\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|way|blvd|boulevard|crescent|cres|place|pl|court|ct))/i);
  if (addressMatch) {
    metadata.address = addressMatch[1];
  }

  return metadata;
}

async function main() {
  try {
    const videos = await searchYouTube(CONFIG.SEARCH_QUERY);

    console.log(`Found ${videos.length} videos under ${CONFIG.MAX_DURATION_SECONDS / 60} minutes\n`);

    // Take only the target count
    const selectedVideos = videos.slice(0, CONFIG.TARGET_VIDEO_COUNT);

    // Build manifest
    const manifest: VideoManifest = {
      videos: selectedVideos.map(video => ({
        youtubeId: video.videoId,
        title: video.title,
        description: video.description,
        channelName: video.channelName,
        duration: video.lengthSeconds,
        thumbnailUrl: video.thumbnailUrl,
        metadata: parseMetadataFromTitle(video.title, video.description),
      })),
      lastUpdated: new Date().toISOString(),
    };

    // Log results
    console.log('Selected videos:');
    console.log('================\n');

    manifest.videos.forEach((video, idx) => {
      console.log(`${idx + 1}. ${video.title}`);
      console.log(`   ID: ${video.youtubeId}`);
      console.log(`   Duration: ${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`);
      console.log(`   Channel: ${video.channelName}`);
      console.log(`   Metadata: ${JSON.stringify(video.metadata)}`);
      console.log();
    });

    // Save manifest
    fs.writeFileSync(CONFIG.MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log(`\nManifest saved to: ${CONFIG.MANIFEST_PATH}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
