import React, { useEffect, useState } from 'react';
import { ROOM_ZONE, ZONE_STYLE } from '../../lib/format';
import { data, fmtTime, prefersReducedMotion, useInView } from './shared';

const { tour } = data.sample;

/** The burned-in clock, with what it did to chapter accuracy on a fast-cut tour. */
export const ClockTrick: React.FC = () => (
  <div className="grid md:grid-cols-2 gap-4 items-stretch">
    <figure className="border-2 border-charcoal bg-warmWhite">
      <img src="/explainer/clock-frame.jpg" alt="A low-resolution tour frame with a running 1:15 clock in the top-left corner" className="w-full aspect-video object-cover border-b-2 border-charcoal" />
      <figcaption className="p-3 font-mono text-[11px] text-olive">
        What the model sees: the whole tour at 240p and 2 fps, with ffmpeg's <code>drawtext</code> clock in the corner. ~100 tokens per second of video.
      </figcaption>
    </figure>
    <div className="border-2 border-charcoal bg-warmWhite p-4 flex flex-col justify-center gap-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-olive">Chapters correct on a fast-cut cinematic tour</p>
      {[
        { label: 'Timestamps inferred from the video', n: 4, of: 8 },
        { label: 'Timestamps read off the burned-in clock', n: 17, of: 20 },
      ].map((r, i) => (
        <div key={r.label}>
          <p className="flex justify-between text-sm mb-1"><span>{r.label}</span><strong className="font-mono">{r.n} / {r.of}</strong></p>
          <span className="block h-3 bg-sand border border-charcoal/20">
            <span className={`block h-full ${i ? 'bg-terracotta' : 'bg-charcoal/40'}`} style={{ width: `${(r.n / r.of) * 100}%` }} />
          </span>
        </div>
      ))}
      <p className="text-xs text-charcoal/75">Sampled chapter midpoints checked against the actual frame. Walkthrough-style tours were already close to exact; montage edits with 1–3 second cuts are where drift showed.</p>
    </div>
  </div>
);

const ANSWER = 'The ensuite is located upstairs, connected to the primary bedroom [1:30]. It features a double vanity, a freestanding deep soaking tub, and a glass-enclosed shower [1:42].';
const parseStamp = (s: string) => { const [m, x] = s.split(':').map(Number); return m * 60 + x; };

/** What goes into the chat prompt, and an answer streaming back with citations. */
export const ChatAnatomy: React.FC = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.4);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) return setShown(ANSWER.length);
    const id = setInterval(() => setShown(n => (n >= ANSWER.length ? (clearInterval(id), n) : n + 3)), 30);
    return () => clearInterval(id);
  }, [inView]);
  const text = ANSWER.slice(0, shown);
  const cited = [...text.matchAll(/\[(\d+:\d{2})\]/g)].map(m => parseStamp(m[1]));
  const parts = text.split(/(\[\d+:\d{2}\])/);

  const blocks = [
    ['System', 'Answer only from the listing and scene notes; cite every claim as [m:ss]; say when the tour cannot tell.'],
    ['LISTING', `${tour.name} · beds, baths, price, address, listing blurb`],
    ['ROOMS', tour.chapters.filter(c => c.room !== 'other').slice(0, 5).map(c => `[${fmtTime(c.start)}] ${c.label}`).join(' · ') + ' …'],
    ['SCENES', `${tour.windows.length} windows · Seen / Features / Said for each`],
    ['History', 'Last 6 turns'],
    ['Question', '“Where is the ensuite?”'],
  ];

  return (
    <div ref={ref} className="grid lg:grid-cols-2 gap-4">
      <div className="border-2 border-charcoal bg-warmWhite p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-olive mb-3">Prompt, in order · whole tour fits, no retrieval</p>
        <ol className="space-y-2">
          {blocks.map(([t, d]) => (
            <li key={t} className="flex gap-3 text-sm">
              <span className="w-20 shrink-0 font-mono text-[10px] font-bold uppercase tracking-widest text-terracotta pt-0.5">{t}</span>
              <span className="text-charcoal/85 leading-snug">{d}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="border-2 border-charcoal bg-charcoal text-warmWhite p-4 flex flex-col">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-terracotta mb-3">Streamed answer · real response from production</p>
        <p className={`text-sm leading-relaxed flex-1 ${shown < ANSWER.length ? 'caret' : ''}`}>
          {parts.map((p, i) => /^\[\d+:\d{2}\]$/.test(p)
            ? <span key={i} className="font-mono text-xs font-bold bg-warmWhite text-charcoal px-1 mx-0.5">{p.slice(1, -1)}</span>
            : <span key={i}>{p}</span>)}
        </p>
        <div className="mt-4">
          <div className="relative h-4 flex border border-warmWhite/40">
            {tour.chapters.map(c => (
              <span key={c.start} className={`${ZONE_STYLE[ROOM_ZONE[c.room]].bg} h-full border-r border-charcoal/40`} style={{ width: `${((c.end - c.start) / tour.duration) * 100}%` }} />
            ))}
            {cited.map(t => (
              <span key={t} className="absolute -top-1.5 -bottom-1.5 w-1 bg-terracotta" style={{ left: `${(t / tour.duration) * 100}%` }} />
            ))}
          </div>
          <p className="mt-1 font-mono text-[10px] text-warmWhite/60">Citations land on the timeline; in the player each one is a seek button.</p>
        </div>
      </div>
    </div>
  );
};
