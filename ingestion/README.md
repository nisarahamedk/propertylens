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

Options: `--only <youtubeId>` and `--limit N` merge into the existing outputs; `--catalog-only` rebuilds outputs from the cache with no downloads or API calls; `--concurrency N` sets parallel requests (default 2).

On the Gemini free tier, use `--concurrency 1`. Rate-limit errors are retried after the delay Gemini asks for, so the run slows down instead of failing. If a daily limit runs out, the run lists the unfinished tours and exits 1; run the same command the next day to resume.

### 3. Check the ranking

```bash
GEMINI_API_KEY=... npm run eval
```

Runs the queries in `eval-queries.json` and prints the top three tours for each, with their scores. Add `"expect": ["<youtubeId>"]` to a query to get a hit@3 check. Use the printed score spread to set `SEARCH_MIN_SCORE`.

## Cost and free-tier limits

About 150 minutes of video gives roughly 400 windows. A full build makes about 465 Flash-Lite calls (one per window, one summary per tour) and about 800 embedding calls (clip and notes per window).

That fits the free tier in a day. Check your own limits at https://aistudio.google.com/rate-limit; the free tier for this project allowed:

| Model | Per minute | Per day |
|---|---|---|
| `gemini-3.5-flash-lite` | 15 requests | 500 requests |
| `gemini-embedding-2` | 100 requests, 30K tokens | 1,000 requests |

The embedding token limit is the slow part: a 30-second clip is several thousand tokens, so expect a few hours. Start on a day with little other usage so the daily embedding limit covers the whole run.

Full Flash models (`gemini-flash-latest`, `gemini-3.5-flash`) allow only 20 requests a day on the free tier, so they need billing for a full build.

At serve time, each search costs one embedding call and each chat question or filter search ("3 bed in Burnaby") one Flash-Lite call. When Flash-Lite is out of quota, filter parsing falls back to rules and chat reports that it is busy.
