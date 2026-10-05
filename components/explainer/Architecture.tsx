import React, { useState } from 'react';
import { data } from './shared';

type Mode = 'prod' | 'demo';
interface Node { title: string; tech: string; why: string }
interface Lane { name: string; when: string; accent?: boolean; nodes: Node[] }

const { ranking, segment } = data.settings;

const PROD: Lane[] = [
  {
    name: 'Ingest & index',
    when: 'Per video, event-driven',
    nodes: [
      { title: 'Sources', tech: 'MLS / RESO Web API · agent uploads · YouTube', why: 'A listing feed or an upload webhook drops a job per video. Idempotent by video id, so replays and re-deliveries are harmless.' },
      { title: 'Landing', tech: 'Cloud Storage → Pub/Sub', why: 'Raw media lands in a bucket; a Pub/Sub message per object fans work out to the workers, with a dead-letter topic for poison videos.' },
      { title: 'Media workers', tech: 'Cloud Run Jobs · ffmpeg · scene detection · Chirp ASR · OCR', why: 'Transcode to HLS for playback, cut at real shot boundaries instead of fixed windows, transcribe with word timestamps, and read on-screen text (prices, addresses, title cards).' },
      { title: 'Understanding', tech: 'Gemini Flash on Vertex AI', why: 'Structured notes per scene (room, caption, features), timed room chapters from the whole video, and listing facts kept only when the source text states them.' },
      { title: 'Embeddings', tech: 'Gemini Embedding 2 · 768-d · versioned', why: `Two vectors per scene: the clip itself (video + audio) and its written notes. Each model version writes to its own namespace, so a re-index swaps over with zero downtime.` },
      { title: 'Stores', tech: 'Pinecone · Cloud SQL (Postgres) · Cloud CDN', why: 'Pinecone serverless holds dense and sparse vectors with listing metadata (price, beds, area, status) for filtered hybrid queries; Postgres is the system of record; the CDN serves stills and HLS.' },
    ],
  },
  {
    name: 'Search',
    when: 'Every query, p95 < 300 ms target',
    accent: true,
    nodes: [
      { title: 'Client', tech: 'Web · app · agent tools', why: 'Natural-language query plus the user\'s own facets (saved areas, budget).' },
      { title: 'API', tech: 'Cloud Run · Load Balancing · Cloud Armor', why: 'Stateless, autoscaled, with per-tenant rate limits and WAF in front. Keys never reach the client.' },
      { title: 'Parse', tech: 'Gemini Flash · cached in Memorystore', why: 'Splits "3 bed in Surrey with a fenced backyard" into hard filters and a description. A cheap regex gate skips the model for plain descriptions; repeat queries hit the cache.' },
      { title: 'Retrieve', tech: 'Pinecone hybrid query · filters in-index', why: 'One query: dense (query vector vs clip and notes vectors) plus sparse keywords, with the filters applied inside the index rather than after it, so filtered recall stays high.' },
      { title: 'Rerank', tech: 'Vertex AI Ranking API · top 50', why: 'A cross-encoder rescores the shortlist against the full scene notes. Cheap at 50 candidates, and the biggest precision win per millisecond.' },
      { title: 'Calibrate & group', tech: 'Per-corpus floor · chapter-aware moments', why: `Drop scenes below a calibrated relevance floor (${ranking.minBlended} on this corpus), group by listing, and show the room chapter that matched with its own still and start time.` },
    ],
  },
  {
    name: 'Ask the tour',
    when: 'On a listing',
    nodes: [
      { title: 'Context', tech: 'Scene notes + room timeline from Postgres', why: 'A tour is minutes long, so all of its notes fit one prompt. Long-form content (open-house streams, developments) switches to retrieval scoped to the listing.' },
      { title: 'Guardrails', tech: 'Fair Housing policy check', why: 'Steering questions ("safe area?", "good for families?") are redirected to objective facts. Brokerages carry this compliance risk; the system should carry it too.' },
      { title: 'Answer', tech: 'Gemini Flash · streamed · cited', why: 'Answers only from what the tour shows or says, with [m:ss] citations the player turns into seek buttons.' },
    ],
  },
];

const DEMO: Lane[] = [
  {
    name: 'Ingest & index',
    when: 'Offline script, resumable',
    nodes: [
      { title: 'Sources', tech: 'YouTube tours · manifest.json', why: '63 public BC house tours, 143 minutes of video, downloaded once with yt-dlp.' },
      { title: 'Landing', tech: 'Local disk · per-window cache', why: 'Each finished window is cached, so an interrupted run resumes where it stopped and a failed tour keeps what it has.' },
      { title: 'Media workers', tech: `ffmpeg · ${segment.length}s windows every ${segment.step}s`, why: 'Fixed windows with a 5-second overlap instead of shot detection: simple, and no room is cut in half at a boundary.' },
      { title: 'Understanding', tech: `${data.models.flash}`, why: 'JSON-schema output per window, plus one pass over each whole tour (240p, clock burned in) for timed chapters.' },
      { title: 'Embeddings', tech: `${data.models.embedding} · ${data.models.dims}-d`, why: `${data.stats.vectors} vectors: clip and notes for each of ${data.stats.scenes} scenes.` },
      { title: 'Stores', tech: `vectors.json (${data.stats.vectorsMB} MB) · properties.json · stills`, why: 'Flat files bundled with the functions. At this size an in-memory scan beats any index structure.' },
    ],
  },
  {
    name: 'Search',
    when: 'Every query, ~0.2–0.6 s',
    accent: true,
    nodes: [
      { title: 'Client', tech: 'React SPA', why: 'The page you are on.' },
      { title: 'API', tech: 'Vercel Functions', why: 'The index loads into memory on cold start; warm requests score in under 10 ms.' },
      { title: 'Parse', tech: 'Regex gate → Flash-Lite or rules', why: 'Plain descriptions skip the model entirely; if the model is busy, rule-based parsing takes over.' },
      { title: 'Retrieve', tech: 'Brute-force cosine + BM25 in memory', why: `${data.stats.scenes} scenes × 2 dot products of ${data.models.dims} floats, plus BM25 over the notes.` },
      { title: 'Rerank', tech: `Reciprocal rank fusion (k = ${ranking.rrf.k})`, why: 'Merges three rankings without putting their scores on one scale. Production replaces this with native hybrid scoring plus a cross-encoder.' },
      { title: 'Calibrate & group', tech: `Floor ${ranking.minBlended} · exact-word bypass`, why: 'The same calibration and chapter-aware moments as production, fitted on this corpus.' },
    ],
  },
  {
    name: 'Ask the tour',
    when: 'On a listing',
    nodes: [
      { title: 'Context', tech: 'Scene notes + room timeline', why: 'Read straight from properties.json.' },
      { title: 'Guardrails', tech: 'Prompt-level grounding only', why: 'The demo instructs the model to answer only from the tour; production adds a policy check.' },
      { title: 'Answer', tech: `${data.models.flash} · streamed`, why: 'Server-sent events from Gemini, relayed as a text stream.' },
    ],
  },
];

const OPS = [
  ['Evaluation', 'Golden queries per market; hit@k, nDCG and a calibration report on every re-index'],
  ['Observability', 'Cloud Monitoring: p95 latency, cost per 1k queries, failures per pipeline stage'],
  ['Feedback', 'Clicks and watch time on result moments feed ranking'],
  ['Spend & quotas', 'Budgets, per-tenant rate limits, separate projects for indexing and serving'],
  ['Rights & privacy', 'Video licensing, face and personal-item blurring, retention policy'],
];

const Connector: React.FC<{ accent?: boolean }> = ({ accent }) => (
  <div aria-hidden="true" className="flex items-center justify-center shrink-0 md:w-6 h-5 md:h-auto">
    <div className={`${accent ? 'flow-accent' : ''} md:hidden flow-v w-0.5 h-full`} />
    <div className={`${accent ? 'flow-accent' : ''} hidden md:block flow-h h-0.5 w-full`} />
  </div>
);

const Architecture: React.FC = () => {
  const [mode, setMode] = useState<Mode>('prod');
  const [open, setOpen] = useState<string | null>('Search:Retrieve');
  const lanes = mode === 'prod' ? PROD : DEMO;

  return (
    <div>
      <div role="tablist" aria-label="Architecture" className="inline-flex border-2 border-charcoal mb-6">
        {(['prod', 'demo'] as Mode[]).map(m => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest ${mode === m ? 'bg-charcoal text-warmWhite' : 'bg-warmWhite text-charcoal hover:bg-sand'}`}
          >
            {m === 'prod' ? 'Production (GCP + Pinecone)' : 'This demo'}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {lanes.map(lane => {
          const selected = lane.nodes.find(n => open === `${lane.name}:${n.title}`);
          return (
            <div key={lane.name}>
              <div className="flex items-baseline gap-3 mb-2">
                <h3 className="font-display text-xl font-bold text-charcoal uppercase">{lane.name}</h3>
                <span className="font-mono text-[10px] uppercase tracking-widest text-olive">{lane.when}</span>
              </div>
              <div className="flex flex-col md:flex-row md:items-stretch">
                {lane.nodes.map((n, i) => {
                  const key = `${lane.name}:${n.title}`;
                  const active = open === key;
                  return (
                    <React.Fragment key={key}>
                      {i > 0 && <Connector accent={lane.accent} />}
                      <button
                        onClick={() => setOpen(active ? null : key)}
                        aria-expanded={active}
                        className={`md:flex-1 min-w-0 text-left p-3 border-2 border-charcoal transition-colors ${
                          active ? 'bg-charcoal text-warmWhite shadow-neobrutal-sm' : 'bg-warmWhite text-charcoal hover:bg-sand'
                        }`}
                      >
                        <span className="block font-mono text-[10px] font-bold uppercase tracking-widest opacity-70">{n.title}</span>
                        <span className="block text-sm font-semibold leading-snug mt-1">{n.tech}</span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
              {selected && (
                <p className="mt-3 border-l-4 border-terracotta bg-warmWhite px-4 py-3 text-sm text-charcoal leading-relaxed">
                  <strong className="font-mono text-[11px] uppercase tracking-widest mr-2">{selected.title}</strong>
                  {selected.why}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {mode === 'prod' && (
        <div className="mt-8 border-2 border-dashed border-charcoal/40 p-4">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-olive mb-3">Around every path</p>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {OPS.map(([t, d]) => (
              <li key={t} className="text-sm">
                <span className="block font-semibold text-charcoal">{t}</span>
                <span className="text-charcoal/75 leading-snug">{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 font-mono text-[11px] text-olive">Tap a stage for what it does and why. Also runs on AWS (S3, SQS, ECS) or with pgvector in place of Pinecone.</p>
    </div>
  );
};

export default Architecture;
