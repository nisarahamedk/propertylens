/**
 * Ragie Upload Script
 * Uploads downloaded videos to Ragie with metadata
 *
 * Usage: npx ts-node ingestion/upload.ts
 */

import fs from 'fs';
import path from 'path';
import { CONFIG, VideoManifest } from './config';

interface RagieDocumentResponse {
  id: string;
  name: string;
  status: string;
  metadata: Record<string, any>;
  created_at: string;
}

async function uploadToRagie(
  filePath: string,
  metadata: Record<string, any>
): Promise<RagieDocumentResponse | null> {
  const fileName = path.basename(filePath);

  // Create form data
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'video/mp4' });
  formData.append('file', blob, fileName);
  formData.append('metadata', JSON.stringify(metadata));
  // Video mode for multimodal processing
  formData.append('mode', JSON.stringify({ video: 'audio_video', audio: true }));

  try {
    const response = await fetch(`${CONFIG.RAGIE_API_URL}/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.RAGIE_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Failed to upload ${fileName}:`, error);
    return null;
  }
}

async function main() {
  // Check API key
  if (!CONFIG.RAGIE_API_KEY) {
    console.error('Error: RAGIE_API_KEY environment variable not set.');
    console.error('Set it with: export RAGIE_API_KEY=your_key_here');
    process.exit(1);
  }

  // Load manifest
  if (!fs.existsSync(CONFIG.MANIFEST_PATH)) {
    console.error('Error: manifest.json not found. Run youtube-search.ts first.');
    process.exit(1);
  }

  const manifest: VideoManifest = JSON.parse(fs.readFileSync(CONFIG.MANIFEST_PATH, 'utf-8'));

  // Filter videos that have been downloaded but not uploaded
  const videosToUpload = manifest.videos.filter(v => v.localPath && !v.ragieDocumentId);

  if (videosToUpload.length === 0) {
    console.log('No videos to upload. Either all are uploaded or none are downloaded.');
    console.log('Run download.ts first if videos are not downloaded.');
    return;
  }

  console.log(`Uploading ${videosToUpload.length} videos to Ragie...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < videosToUpload.length; i++) {
    const video = videosToUpload[i];

    if (!video.localPath || !fs.existsSync(video.localPath)) {
      console.error(`[${i + 1}/${videosToUpload.length}] File not found: ${video.localPath}`);
      failCount++;
      continue;
    }

    console.log(`[${i + 1}/${videosToUpload.length}] Uploading: ${video.title}`);

    // Build metadata for Ragie
    const metadata = {
      youtubeId: video.youtubeId,
      title: video.title,
      description: video.description,
      channelName: video.channelName,
      duration: video.duration,
      thumbnailUrl: video.thumbnailUrl,
      // Parsed metadata
      location: video.metadata.location || video.title,
      address: video.metadata.address || 'BC, Canada',
      bed: video.metadata.beds || 0,
      bath: video.metadata.baths || 0,
      sqft: video.metadata.sqft || 0,
      price: video.metadata.price || '',
    };

    const result = await uploadToRagie(video.localPath, metadata);

    if (result) {
      video.ragieDocumentId = result.id;
      successCount++;
      console.log(`   Document ID: ${result.id}`);
      console.log(`   Status: ${result.status}`);
    } else {
      failCount++;
    }

    // Delay between uploads to avoid rate limiting
    if (i < videosToUpload.length - 1) {
      console.log('   Waiting 2s before next upload...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Update manifest with Ragie document IDs
  manifest.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG.MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(`\n========================================`);
  console.log(`Upload complete!`);
  console.log(`Success: ${successCount}/${videosToUpload.length}`);
  console.log(`Failed: ${failCount}/${videosToUpload.length}`);
  console.log(`Manifest updated: ${CONFIG.MANIFEST_PATH}`);
}

main();
