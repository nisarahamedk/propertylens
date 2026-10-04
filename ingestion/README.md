# Ingestion

Builds the search index from YouTube house tours.

## Prerequisites

- Node.js 18+
- `yt-dlp` (`brew install yt-dlp`) and `ffmpeg` (`brew install ffmpeg`)
- A Gemini API key

## Workflow

### 1. Find videos (optional)

```bash
npx tsx ingestion/youtube-search.ts
```

Scrapes YouTube for BC house tours between 1 and 5 minutes and writes `manifest.json`. The committed manifest already lists 65 tours, so skip this unless you want different videos.

### 2. Build the index

```bash
GEMINI_API_KEY=... npm run index
```

For each video in the manifest:

1. Checks the video is still public (YouTube oEmbed) and skips it if not. Pass `--skip-check` to skip this check.
2. Downloads it to `ingestion/videos/` with yt-dlp.
3. Cuts 30-second windows every 25 seconds into small 360p clips and saves a still from the middle of each to `public/frames/`.
4. Sends each clip to Gemini Flash for the room, a caption, searchable features and a transcript.
5. Embeds the clip and the written notes with Gemini Embedding 2.
6. Writes a short summary and highlights per property from the captions.

Outputs:

- `data/properties.json`: catalog and scene notes. Imported by the frontend.
- `data/vectors.json`: base64 float32 vectors keyed by scene id. Read by the API only.
- `public/frames/*.jpg`: one still per scene.

Every finished window is cached in `ingestion/.cache/<youtubeId>.json`. Re-running only processes what is missing. Delete a video's cache file to re-index it.

Options: `--only <youtubeId>` and `--limit N` merge into the existing outputs; `--catalog-only` rebuilds outputs from the cache with no downloads or API calls.

### 3. Check the ranking

```bash
GEMINI_API_KEY=... npm run eval
```

Runs the queries in `eval-queries.json` and prints the top three tours for each, with their scores. Add `"expect": ["<youtubeId>"]` to a query to get a hit@3 check. Use the printed score spread to set `SEARCH_MIN_SCORE`.

## Cost

About 150 minutes of video gives roughly 400 windows. Expect a one-time Gemini bill of around $10–15 for the clip embeddings and captions; text embeddings and summaries add very little.
