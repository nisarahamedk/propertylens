# Ingestion Pipeline

Scripts for building the PropertyLens video index from YouTube house tours.

## Prerequisites

- Node.js with ts-node
- yt-dlp: `brew install yt-dlp`
- Ragie API key

## Workflow

### 1. Search YouTube for videos

```bash
npx ts-node ingestion/youtube-search.ts
```

Searches for house tours in BC under 5 minutes, saves results to `manifest.json`.

### 2. Download videos

```bash
npx ts-node ingestion/download.ts
```

Downloads videos to `ingestion/videos/` directory using yt-dlp.

### 3. Upload to Ragie

```bash
export RAGIE_API_KEY=your_key_here
npx ts-node ingestion/upload.ts
```

Uploads videos to Ragie with metadata extracted from title/description.

## Files

- `config.ts` - Configuration and types
- `youtube-search.ts` - YouTube scraper
- `download.ts` - Video downloader
- `upload.ts` - Ragie uploader
- `manifest.json` - Video metadata and status
- `videos/` - Downloaded .mp4 files (gitignored)

## Metadata Extraction

The scraper attempts to extract from video titles/descriptions:
- Location (BC cities)
- Beds/baths
- Square footage
- Price
- Street address
