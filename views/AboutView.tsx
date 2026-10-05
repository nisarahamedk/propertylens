import React from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import Pipeline, { type Step } from '../components/explainer/Pipeline';

// Small "what the data looks like now" panels that ride along each step.
const Box: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <div className={`border-2 border-charcoal px-2.5 py-2 text-xs leading-snug ${dark ? 'bg-charcoal text-warmWhite font-mono' : 'bg-sand text-charcoal'}`}>{children}</div>
);
const Chip: React.FC<{ children: React.ReactNode; solid?: boolean }> = ({ children, solid }) => (
  <span className={`inline-block px-1.5 py-0.5 mr-1 mb-1 font-mono text-[11px] border-2 border-charcoal ${solid ? 'bg-charcoal text-warmWhite' : 'bg-warmWhite font-bold'}`}>{children}</span>
);
// An illustrative slice of an embedding: 48 of its 768 numbers as colour.
const VECTOR = Array.from({ length: 48 }, (_, i) => Math.sin(i * 1.7) * Math.cos(i * 0.6));
const Vector: React.FC = () => (
  <div className="flex h-4 border-2 border-charcoal" aria-hidden="true">
    {VECTOR.map((v, i) => (
      <span key={i} className="flex-1" style={{ background: v > 0 ? `rgba(198,123,92,${0.25 + v * 0.75})` : `rgba(63,127,176,${0.25 - v * 0.75})` }} />
    ))}
  </div>
);

const INDEXING: Step[] = [
  {
    title: 'Ingest',
    tech: 'Cloud Storage → Pub/Sub',
    what: 'A listing feed or agent upload drops the tour video into storage and queues one job per video.',
    example: <Box>Abbotsford townhome tour · 3:33 · MP4</Box>,
  },
  {
    title: 'Split',
    tech: 'Cloud Run Jobs · ffmpeg · speech-to-text',
    what: 'Workers cut the video into scenes at each camera cut and transcribe what the agent says, with timestamps.',
    example: <Box>9 scenes · 31 rooms · transcript with timestamps</Box>,
  },
  {
    title: 'Understand',
    tech: 'Gemini on Vertex AI',
    what: 'Gemini watches each scene and writes down the room, what is visible and what is said, and times when every room appears.',
    example: (
      <Box>
        <span className="font-mono text-[10px] font-bold uppercase">Ensuite · 1:42</span>
        <br />Double vanity, quartz counters, freestanding soaker tub, glass shower.
      </Box>
    ),
  },
  {
    title: 'Embed',
    tech: 'Gemini Embedding',
    what: 'Each scene becomes two vectors: one from the video itself, one from its notes. Similar meaning, nearby vectors.',
    example: (
      <div className="space-y-1">
        <Vector />
        <p className="font-mono text-[10px] text-olive">768 numbers per vector</p>
      </div>
    ),
  },
  {
    title: 'Store',
    tech: 'Pinecone · Postgres · CDN',
    what: 'Pinecone holds the vectors with listing details for filtering; Postgres keeps the notes; the CDN serves stills and video.',
    example: <Box dark>{'{ vectors, keywords,\n  beds: 4,\n  area: "Abbotsford",\n  room: "Ensuite",\n  t: 102 }'.split('\n').map((l, i) => <span key={i} className="block whitespace-pre">{l}</span>)}</Box>,
  },
];

const QUERY: Step[] = [
  {
    title: 'Ask',
    tech: 'Web or app',
    what: 'A buyer types what they want in plain words.',
    example: <Box>“3 bed in Surrey with a fenced backyard”</Box>,
  },
  {
    title: 'Understand',
    tech: 'Gemini (cached)',
    what: 'The query is split into hard filters and a description of what to look for.',
    example: (
      <div>
        <Chip>beds ≥ 3</Chip>
        <Chip>Surrey</Chip>
        <Chip solid>fenced backyard</Chip>
      </div>
    ),
  },
  {
    title: 'Search',
    tech: 'Pinecone hybrid query',
    what: 'One query matches the description by meaning and by keyword, only among homes that pass the filters.',
    example: <Box>Top 50 scenes from 3+ bed Surrey homes</Box>,
  },
  {
    title: 'Rerank',
    tech: 'Vertex AI Ranking',
    what: 'A ranking model reads the query and each scene’s notes together, reorders them, and drops weak matches.',
    example: <Box>4 homes clearly show a fenced backyard</Box>,
  },
  {
    title: 'Show the moment',
    tech: 'API → player',
    what: 'Results are grouped by home, and each opens at the room that matched.',
    example: (
      <div className="border-2 border-charcoal bg-warmWhite">
        <div className="relative">
          <img src="/frames/DqXM07TYfdM_c0770.jpg" alt="Fenced backyard in a Surrey home" loading="lazy" className="w-full aspect-video object-cover" />
          <span className="absolute left-1 top-1 bg-charcoal text-warmWhite font-mono text-[10px] font-bold px-1">BACKYARD</span>
          <span className="absolute right-1 bottom-1 bg-terracotta text-white font-mono text-[10px] font-bold px-1 border border-charcoal">1:40</span>
        </div>
        <p className="px-2 py-1 font-mono text-[10px] text-charcoal">Surrey · 3 bed · $1.79M</p>
      </div>
    ),
  },
];

const AboutView: React.FC = () => (
  <div className="min-h-screen bg-cream">
    <AppHeader back="/" />
    <main className="max-w-7xl mx-auto px-4 md:px-6 pt-10 pb-20">
      <p className="font-mono text-xs uppercase tracking-widest text-terracotta mb-3">How it works</p>
      <h1 className="font-display text-4xl md:text-5xl font-bold text-charcoal leading-tight mb-4 max-w-3xl">
        Search inside the video, not just the listing.
      </h1>
      <p className="text-lg text-charcoal/80 max-w-2xl mb-12">
        Every tour is watched once, room by room, and stored as searchable scenes. A search then finds the exact moment that
        matches, in well under a second.
      </p>

      <section className="mb-14">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-charcoal mb-1">1. Indexing a tour</h2>
        <p className="font-mono text-[11px] uppercase tracking-widest text-olive mb-5">Once per video, in the background</p>
        <Pipeline steps={INDEXING} />
      </section>

      <section className="mb-14">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-charcoal mb-1">2. Answering a search</h2>
        <p className="font-mono text-[11px] uppercase tracking-widest text-olive mb-5">Every query, live</p>
        <Pipeline steps={QUERY} accent />
      </section>

      <Link to="/" className="inline-block px-5 py-3 bg-charcoal text-warmWhite border-2 border-charcoal font-mono text-xs font-bold uppercase tracking-widest hover:bg-terracotta">
        Try a search
      </Link>
    </main>
  </div>
);

export default AboutView;
