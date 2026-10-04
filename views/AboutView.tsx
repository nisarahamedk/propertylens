import React from 'react';
import { Link } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { catalog, properties, totalScenes } from '../services/api';

const minutes = Math.round(properties.reduce((n, p) => n + p.duration, 0) / 60);

const STEPS = [
  {
    title: 'Index',
    when: 'Once, offline',
    body: 'Each tour is cut into 30-second scenes. Gemini Flash writes down the room, what is visible and what the agent says. Gemini Embedding 2 turns both the clip itself and those notes into vectors.',
  },
  {
    title: 'Search',
    when: 'Every query',
    body: 'Filters like “3 bed in Burnaby under $2M” are pulled out of the query first. The rest is embedded and compared against every scene, by what is seen, what is heard and the exact words used, then fused into one ranking.',
  },
  {
    title: 'Ask',
    when: 'On a tour',
    body: 'A tour is only a few minutes long, so every scene note fits in one prompt. Answers stay inside what the video shows and cite timestamps you can click.',
  },
];

const AboutView: React.FC = () => (
  <div className="min-h-screen bg-cream">
    <AppHeader back="/" />
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-12">
      <p className="font-mono text-xs uppercase tracking-widest text-olive mb-3">How it works</p>
      <h1 className="font-display text-4xl md:text-5xl font-bold text-charcoal leading-none mb-6">
        Search what a house looks like, not just what the listing says.
      </h1>
      <p className="text-lg text-charcoal/80 max-w-2xl mb-12">
        Listing text rarely mentions the herringbone floors or the view from the primary bedroom. The tour video does.
        PropertyLens indexes the video itself, so you can search for what you want to see and land on the second it appears.
      </p>

      <ol className="grid md:grid-cols-3 gap-6 mb-14">
        {STEPS.map((s, i) => (
          <li key={s.title} className="bg-warmWhite border-2 border-charcoal shadow-neobrutal p-5 flex flex-col">
            <div className="flex items-baseline justify-between mb-3">
              <span className="font-display text-2xl font-bold text-charcoal uppercase">
                <span className="text-terracotta">{i + 1}.</span> {s.title}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-olive">{s.when}</span>
            </div>
            <p className="text-sm text-charcoal/85 leading-relaxed">{s.body}</p>
          </li>
        ))}
      </ol>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
        {[
          [properties.length, 'tours'],
          [minutes, 'minutes of video'],
          [totalScenes, 'indexed scenes'],
          [catalog.models?.dims ?? 768, 'vector dimensions'],
        ].map(([value, label]) => (
          <div key={label} className="border-2 border-charcoal bg-warmWhite p-4">
            <dt className="font-mono text-[10px] uppercase tracking-wider text-olive">{label}</dt>
            <dd className="font-mono text-3xl font-bold text-charcoal tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="font-display text-2xl font-bold text-charcoal uppercase mb-4">Built with</h2>
      <ul className="text-charcoal/85 space-y-2 mb-12 list-disc pl-5">
        <li>React 19, Vite and Tailwind, deployed on Vercel</li>
        <li>Two serverless functions: <code className="font-mono text-sm">/api/search</code> and <code className="font-mono text-sm">/api/chat</code>, holding the only API key</li>
        <li>{catalog.models?.embedding ?? 'gemini-embedding-2'} for clip and text vectors; {catalog.models?.describe ?? 'Gemini Flash'} for scene notes, query parsing and answers</li>
        <li>A static JSON index scored in memory. No vector database is needed at this size.</li>
        <li>Tour videos stream from YouTube and belong to their creators.</li>
      </ul>

      <Link
        to="/"
        className="inline-block px-6 py-3 bg-terracotta text-white border-2 border-charcoal shadow-neobrutal font-mono text-xs font-bold uppercase tracking-widest"
      >
        Try a search
      </Link>
    </main>
  </div>
);

export default AboutView;
