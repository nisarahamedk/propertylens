import React from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import Architecture from '../components/explainer/Architecture';
import Calibration from '../components/explainer/Calibration';
import { ChatAnatomy, ClockTrick } from '../components/explainer/Grounding';
import QueryLab from '../components/explainer/QueryLab';
import { Embeddings, SceneNotes } from '../components/explainer/SceneAnatomy';
import Timeline from '../components/explainer/Timeline';
import { Code, data, ProdNote, Section } from '../components/explainer/shared';

const { stats, settings, models } = data;
const R = settings.ranking;
const absentMax = Math.max(...data.calibration.absent.map(p => p.top));
const presentMin = Math.min(...data.calibration.present.map(p => p.top));

const NAV = [
  ['architecture', 'Architecture'],
  ['segment', 'Segment'],
  ['understand', 'Understand'],
  ['embed', 'Embed'],
  ['query', 'Query'],
  ['calibrate', 'Calibrate'],
  ['ground', 'Ground'],
  ['ask', 'Ask'],
  ['scale', 'Scale'],
  ['limits', 'Limits'],
];

const AboutView: React.FC = () => (
  <div className="min-h-screen bg-cream">
    <AppHeader back="/" />
    <main className="max-w-6xl mx-auto px-4 md:px-6 pt-10 pb-20">
      <header className="pb-10">
        <p className="font-mono text-xs uppercase tracking-widest text-terracotta mb-3">How it works</p>
        <h1 className="font-display text-4xl md:text-6xl font-bold text-charcoal leading-[0.95] mb-6 max-w-4xl">
          Retrieval-augmented generation over video, built for property tours.
        </h1>
        <p className="text-lg text-charcoal/80 max-w-3xl mb-8">
          Listing text rarely mentions the herringbone floors or the view from the primary bedroom. The tour video does.
          PropertyLens indexes the video itself, so a query lands on the second a room appears, and a chat answers from
          what the tour shows and says. This page walks through the pipeline with the real numbers from this index, and how
          we would run it in production.
        </p>
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            [stats.tours, 'tours'],
            [stats.minutes, 'minutes of video'],
            [stats.scenes, 'search windows'],
            [stats.chapters, 'timed room chapters'],
            [stats.vectors, `vectors · ${models.dims}-d`],
            [`${stats.vectorsMB} MB`, 'vector index'],
          ].map(([v, l]) => (
            <div key={String(l)} className="border-2 border-charcoal bg-warmWhite p-3">
              <dt className="font-display text-2xl md:text-3xl font-bold text-charcoal">{v}</dt>
              <dd className="font-mono text-[10px] uppercase tracking-widest text-olive mt-1">{l}</dd>
            </div>
          ))}
        </dl>
        <nav aria-label="Sections" className="mt-8 flex flex-wrap gap-2">
          {NAV.map(([id, label], i) => (
            <a key={id} href={`#${id}`} className="px-2 py-1 border-2 border-charcoal/30 hover:border-charcoal font-mono text-[11px] uppercase tracking-widest text-charcoal">
              <span className="text-terracotta">{i + 1}</span> {label}
            </a>
          ))}
        </nav>
      </header>

      <Section
        id="architecture"
        kicker="1 · Architecture"
        title="Two paths over one index"
        lede={
          <p>
            Indexing runs once per video and turns footage into structured, embedded scenes. Search and chat run per request
            against that index. The production view is how we would deploy this for a brokerage or portal; the demo view is
            what serves this site, with the same stages on lighter infrastructure.
          </p>
        }
      >
        <Architecture />
      </Section>

      <Section
        id="segment"
        kicker="2 · Segment"
        title="Cut the tour into searchable windows, and time the rooms separately"
        lede={
          <>
            <p>
              Search needs units small enough to land on a moment and large enough to carry context. Each tour is cut into{' '}
              {settings.segment.length}-second windows every {settings.segment.step} seconds; the {settings.segment.length - settings.segment.step}-second
              overlap means a room is never only half in a window. {settings.segment.length} seconds also sits well inside what the
              embedding model accepts as one video input.
            </p>
            <p>
              Rooms change every 5–15 seconds, far faster than the windows. So a second pass sends the whole tour to the model once
              and gets back timed chapters, which drive the player's timeline and decide which room a result shows.
            </p>
          </>
        }
      >
        <Timeline />
        <ProdNote>
          Cut at real shot boundaries (scene detection in the media workers) and merge short shots up to a target length, instead
          of fixed windows. Moments then start on a cut, and search granularity improves from ~{settings.segment.step}s to the length of a shot.
        </ProdNote>
      </Section>

      <Section
        id="understand"
        kicker="3 · Understand"
        title="Turn each window into structured notes"
        lede={
          <p>
            Each window goes to {models.flash} as a 360p clip with audio, with a JSON schema for the response: a room from a fixed
            enum, a caption, searchable features and a verbatim transcript (empty when there is only music). The schema keeps the
            output parseable, and the fixed room list keeps labels consistent across thousands of videos.
          </p>
        }
      >
        <SceneNotes />
        <ProdNote>
          Run the same prompts on Vertex AI, with batch prediction for back-catalogue imports. Add dedicated speech-to-text with word
          timestamps (Chirp) and OCR for on-screen prices, addresses and title cards. Listing facts are extracted the same way and
          kept only when a quoted span is found verbatim in the source.
        </ProdNote>
      </Section>

      <Section
        id="embed"
        kicker="4 · Embed"
        title="Two vectors per scene: what is seen, and what is written down"
        lede={
          <>
            <p>
              {models.embedding} embeds the clip itself, video and audio, into the same space as text. That catches what nobody wrote
              down. A second vector embeds the notes, which is where the agent's words live. Both are truncated to {models.dims} dimensions
              (Matryoshka) and re-normalised, so scoring is a plain dot product.
            </p>
            <p>
              Queries and notes get the model's task prefixes: <Code>task: search result | query: …</Code> for queries and{' '}
              <Code>title: … | text: …</Code> for documents.
            </p>
          </>
        }
      >
        <Embeddings />
        <ProdNote>
          One Pinecone record per scene with both dense vectors (or one per vector type in separate namespaces), a sparse vector for
          keywords, and listing metadata (price, beds, area, status, listing id) for filtering. Namespaces are versioned by embedding
          model, so a model upgrade re-indexes alongside the live index and swaps over atomically.
        </ProdNote>
      </Section>

      <Section
        id="query"
        kicker="5 · Query"
        title="Parse, filter, score three ways, fuse, gate, group"
        lede={
          <>
            <p>
              Hard constraints (beds, price, area) are pulled out first, by a model only when a cheap regex sees something filter-like,
              and applied before any vector math. The descriptive remainder is scored against every candidate scene three ways:
              cosine to the clip vector (seen), cosine to the notes vector (heard) and BM25 over the notes (exact words).
            </p>
            <p>
              The three scores are on different scales, so reciprocal rank fusion orders results by rank instead:{' '}
              <Code>Σ wᵢ / (k + rankᵢ)</Code> with k = {R.rrf.k}. A separate relevance gate decides what is shown at all. Change the knobs
              below and the ranking recomputes with the server's arithmetic.
            </p>
          </>
        }
      >
        <QueryLab />
        <ProdNote>
          Pinecone runs dense and sparse retrieval as one hybrid query, with the filters applied inside the index rather than after it.
          The top 50 then go through the Vertex AI Ranking API, a cross-encoder that reads the query and the scene notes together. Parsed
          queries are cached in Memorystore, so repeat searches skip the model.
        </ProdNote>
      </Section>

      <Section
        id="calibrate"
        kicker="6 · Calibrate"
        title="Cosine similarity is not a probability"
        lede={
          <>
            <p>
              Every scene scores somewhere between 0.5 and 0.75 against every query, so “top result” always exists, even for nonsense.
              The fix is an empirical floor. Across 24 test queries, the best scene for things no tour has peaked at {absentMax.toFixed(3)};
              the best scene for real features started at {presentMin.toFixed(3)}. The floor sits in that gap at {R.minBlended}.
            </p>
            <p>
              Two rules sit beside it. A scene containing every distinctive word of the query passes regardless, so one-word searches like
              “SkyTrain” work. And when filters match homes but nothing clears the floor, the app shows the closest moments and says so,
              rather than padding results.
            </p>
          </>
        }
      >
        <Calibration />
        <ProdNote>
          Re-fit the floor on every re-index from a golden query set per market, and alert on score drift. Reranker scores are better
          calibrated than raw cosines, so in production the gate moves onto the reranker output.
        </ProdNote>
      </Section>

      <Section
        id="ground"
        kicker="7 · Ground in time"
        title="Make the model read the clock"
        lede={
          <>
            <p>
              Vision models describe what is on screen well and say when it happened badly. Asked for room chapters, the model drifted by
              tens of seconds on fast-cut tours. Burning a running clock into the frames it sees, and telling it to read timestamps from
              the clock, fixed most of it.
            </p>
            <p>
              Chapters then feed back into search: each window takes its room from the chapter it mostly overlaps, and every chapter has
              its own still. A result card shows the chapter that matches the query, so “soaker tub in the ensuite” shows the Ensuite,
              starting when the ensuite does.
            </p>
          </>
        }
      >
        <ClockTrick />
        <ProdNote>
          Shot boundaries and word-level transcript timestamps give the chaptering model hard anchors, so the clock becomes a check rather
          than the only source of time. Chapter accuracy is part of the evaluation set.
        </ProdNote>
      </Section>

      <Section
        id="ask"
        kicker="8 · Ask"
        title="Grounded chat without a retrieval step"
        lede={
          <p>
            A tour is a few minutes long, so all of its notes and its room timeline fit in one prompt. There is nothing to retrieve, and
            nothing relevant gets left out. The model is told to answer only from the tour, to cite each claim with a timestamp, and to
            say when the tour cannot answer.
          </p>
        }
      >
        <ChatAnatomy />
        <ProdNote>
          A Fair Housing check runs before generation: steering questions (“is it a safe area?”, “good for families?”) are redirected to
          objective facts. Long-form video (open-house streams, multi-unit developments) switches to retrieval scoped to the listing via
          a metadata filter. Citation accuracy is evaluated alongside retrieval.
        </ProdNote>
      </Section>

      <Section
        id="scale"
        kicker="9 · Scale"
        title="Why there is no vector database here, and why there would be"
        lede={
          <>
            <p>
              This index is {stats.vectors} vectors of {models.dims} floats: {stats.vectorsMB} MB on disk, about 2 MB in memory. A brute-force
              scan of every candidate takes a few milliseconds in a serverless function; an approximate index would add latency and
              recall loss for nothing.
            </p>
            <p>
              A portal or brokerage changes the arithmetic. 100,000 listings with ~4 minutes of video each is about 1 million scenes and 2
              million vectors (~6 GB of float32), filtered by price, area and status on every query, updated continuously. That is what
              Pinecone serverless is for: filtered hybrid search at that size within a p95 latency budget, without operating the cluster.
            </p>
          </>
        }
      >
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            ['Per 4-minute tour', '~10 windows → ~12 Flash calls (notes, chapters, summary) and ~20 embedding calls, once'],
            ['Per search', '1 embedding call, plus 1 Flash call only for queries with filters (cached in production)'],
            ['Per chat answer', '1 streamed Flash call over the tour\'s notes, typically a few thousand tokens'],
          ].map(([t, d]) => (
            <div key={t} className="border-2 border-charcoal bg-warmWhite p-4">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-terracotta mb-1">{t}</p>
              <p className="text-sm text-charcoal/85">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="limits" kicker="10 · Limits" title="Where it is weak, and what production changes">
        <ul className="grid md:grid-cols-2 gap-3">
          {[
            ['Moment granularity', `Fixed windows put a result within ~${settings.segment.step}s of the moment. Shot-based segmentation fixes it.`],
            ['Montage edits', 'Chapters on 1–3 second cuts can still be off by a shot. Shot boundaries as anchors fix most of it.'],
            ['Calibration', `The ${R.minBlended} floor is fitted on ${stats.tours} tours. A new market needs its own golden set and re-fit.`],
            ['Listing facts', 'Only what the title, description or agent states is kept. A feed (MLS / RESO) is the real source in production.'],
            ['Quotas', 'This demo runs on free-tier quotas; a busy day can exhaust them. Production separates indexing and serving projects, with budgets.'],
            ['What it cannot know', 'Anything the video does not show or say. Chat says so instead of guessing.'],
          ].map(([t, d]) => (
            <li key={t} className="border-2 border-charcoal bg-warmWhite p-4">
              <p className="font-semibold text-charcoal mb-1">{t}</p>
              <p className="text-sm text-charcoal/80">{d}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link to="/" className="px-5 py-3 bg-charcoal text-warmWhite border-2 border-charcoal font-mono text-xs font-bold uppercase tracking-widest hover:bg-terracotta">
            Try a search
          </Link>
          <p className="font-mono text-[11px] text-olive">
            Figures on this page are captured from the live index by <Code>ingestion/explainer-snapshot.ts</Code> ({data.generatedAt.slice(0, 10)}).
          </p>
        </div>
      </Section>
    </main>
  </div>
);

export default AboutView;
