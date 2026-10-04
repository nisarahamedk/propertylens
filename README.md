# PropertyLens

Search inside home tour videos by what you want to see or hear, then jump straight to that moment.

Type "3 bed in Burnaby with a big kitchen island" and PropertyLens pulls out the filters (3+ beds, Burnaby), searches every scene of every tour for a kitchen island, and shows the matching moments with a frame, a caption and how strongly each matched on what is **seen** versus what is **heard**. On a tour you get a room-by-room timeline, a scene list that follows playback, and a chat that answers from the video with clickable timestamps.

## How it works

```
                 offline, once                                     every request
┌──────────────┐  yt-dlp   ┌─────────┐  ffmpeg   ┌──────────────┐     ┌───────────────┐
│ manifest.json├──────────►│  mp4s   ├──────────►│ 30s windows  │     │ Browser       │
└──────────────┘           └─────────┘ every 25s └──────┬───────┘     │ (no secrets)  │
                                                        │             └──────┬────────┘
                      Gemini Flash: room, caption,      │                    │ POST /api/search
                      features, transcript  ◄───────────┤                    ▼
                      Gemini Embedding 2: clip vector ◄─┤             ┌───────────────┐  embed query
                      + text vector of the notes        │             │ Vercel fn     ├──────────► Gemini
                                                        ▼             │ index in RAM  │
                         data/properties.json  (scenes, shipped to UI)│ cosine + BM25 │
                         data/vectors.json     (server only)  ───────►│ + RRF fusion  │
                         public/frames/*.jpg                          └───────────────┘
```

- **Index** (`ingestion/build-index.ts`): each tour is cut into 30-second windows with a 5-second overlap. Gemini Flash describes each window; Gemini Embedding 2 embeds both the clip itself and the written notes (768 dimensions).
- **Search** (`server/search.ts`): filter phrases are parsed out first (by Gemini when the query looks like it has any, by rules otherwise). The descriptive remainder is embedded and scored against every scene three ways: visual similarity, speech/caption similarity and BM25 keywords. Reciprocal rank fusion merges them, and results are grouped by property.
- **Ask** (`server/chat.ts`): a tour is a few minutes long, so all its scene notes fit in one prompt. No retrieval step; the answer streams back with `[m:ss]` citations.
- **Storage**: a JSON index scored in memory. At ~500 scenes there is nothing for a vector database to do.

Without `GEMINI_API_KEY` the API falls back to keyword-only search, so the UI still works in development.

## Getting started

```bash
npm install
echo "GEMINI_API_KEY=your_key" > .env.local   # server-side only; never bundled
npm run dev                                   # http://localhost:3000, /api/* served by Vite
```

### Build the index

Needs `yt-dlp` and `ffmpeg` on your PATH.

```bash
GEMINI_API_KEY=your_key npm run index            # all tours in ingestion/manifest.json
npm run index -- --only D81OJRTOkLA              # one tour, merged into the existing index
npm run index -- --catalog-only                  # rebuild outputs from cache, no API calls
GEMINI_API_KEY=your_key npm run eval             # sanity-check ranking after a rebuild
```

Commit `data/` and `public/frames/` afterwards; the deployment serves them as-is. Results are cached per window in `ingestion/.cache/`, so an interrupted run picks up where it stopped. See [ingestion/README.md](ingestion/README.md).

### Deploy

Deploy to Vercel and set `GEMINI_API_KEY` in the project's environment variables. `api/search.ts` and `api/chat.ts` become serverless functions with `data/` bundled in. Set a spending cap on the key; the handlers also rate-limit per IP.

## Project structure

```
api/              Vercel function entry points (thin wrappers)
server/           Search, chat, Gemini client, index loader, Vite dev middleware
ingestion/        Manifest scraper, index builder, ranking eval
data/             Generated index (properties.json, vectors.json)
public/frames/    Generated scene stills
views/            Landing, results, player, all tours, how it works
components/       Match cards, chapter timeline, scene list, chat, YouTube player
services/api.ts   Client for /api/* plus the static catalog
types.ts          Types shared by the app, the API and ingestion
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | none | Required for hybrid search, chat and indexing |
| `GEMINI_EMBEDDING_MODEL` | `gemini-embedding-2` | Must match the model the index was built with |
| `GEMINI_FLASH_MODEL` | `gemini-3.5-flash-lite` | Scene notes, query parsing, chat |
| `SEARCH_MIN_SCORE` | `0.64` | Floor on the blended cosine; tune with `npm run eval` |

Ranking weights live in `server/config.ts`.

## Tech stack

React 19, TypeScript, Vite 6, Tailwind CSS 3, Vercel Functions, Gemini API. Tour videos stream from YouTube and belong to their creators.

## License

MIT
