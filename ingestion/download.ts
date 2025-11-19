/**
 * Video Downloader
 * Downloads videos from YouTube using yt-dlp
 *
 * Prerequisites: yt-dlp must be installed (brew install yt-dlp)
 *
 * Usage: npx ts-node ingestion/download.ts
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { CONFIG, VideoManifest } from './config';

function checkYtDlp(): boolean {
  try {
    execSync('yt-dlp --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function downloadVideo(youtubeId: string, outputPath: string): Promise<boolean> {
  const url = `https://www.youtube.com/watch?v=${youtubeId}`;

  try {
    console.log(`Downloading: ${youtubeId}`);

    // Download with yt-dlp
    // -f: format selection (best mp4 under 720p for reasonable file size)
    // -o: output template
    // --no-playlist: don't download playlists
    execSync(
      `yt-dlp -f "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best" --merge-output-format mp4 -o "${outputPath}" --no-playlist "${url}"`,
      { stdio: 'inherit' }
    );

    return fs.existsSync(outputPath);
  } catch (error) {
    console.error(`Failed to download ${youtubeId}:`, error);
    return false;
  }
}

async function main() {
  // Check yt-dlp is installed
  if (!checkYtDlp()) {
    console.error('Error: yt-dlp is not installed.');
    console.error('Install it with: brew install yt-dlp');
    process.exit(1);
  }

  // Load manifest
  if (!fs.existsSync(CONFIG.MANIFEST_PATH)) {
    console.error('Error: manifest.json not found. Run youtube-search.ts first.');
    process.exit(1);
  }

  const manifest: VideoManifest = JSON.parse(fs.readFileSync(CONFIG.MANIFEST_PATH, 'utf-8'));

  // Ensure videos directory exists
  if (!fs.existsSync(CONFIG.VIDEOS_DIR)) {
    fs.mkdirSync(CONFIG.VIDEOS_DIR, { recursive: true });
  }

  console.log(`Downloading ${manifest.videos.length} videos...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < manifest.videos.length; i++) {
    const video = manifest.videos[i];
    const outputPath = path.join(CONFIG.VIDEOS_DIR, `${video.youtubeId}.mp4`);

    // Skip if already downloaded
    if (fs.existsSync(outputPath)) {
      console.log(`[${i + 1}/${manifest.videos.length}] Already exists: ${video.youtubeId}`);
      video.localPath = outputPath;
      successCount++;
      continue;
    }

    console.log(`\n[${i + 1}/${manifest.videos.length}] ${video.title}`);

    const success = await downloadVideo(video.youtubeId, outputPath);

    if (success) {
      video.localPath = outputPath;
      successCount++;
      console.log(`Successfully downloaded: ${outputPath}`);
    } else {
      failCount++;
      console.error(`Failed to download: ${video.youtubeId}`);
    }

    // Small delay between downloads
    if (i < manifest.videos.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Update manifest with local paths
  manifest.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CONFIG.MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  console.log(`\n========================================`);
  console.log(`Download complete!`);
  console.log(`Success: ${successCount}/${manifest.videos.length}`);
  console.log(`Failed: ${failCount}/${manifest.videos.length}`);
  console.log(`Manifest updated: ${CONFIG.MANIFEST_PATH}`);
}

main();
