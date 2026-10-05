import React, { useEffect, useState } from 'react';
import { data, fmtTime, prefersReducedMotion, useInView } from './shared';

const { scene, vectors } = data.sample;
const { ranking } = data.settings;

const notesJson = JSON.stringify(
  { room: scene.room, caption: scene.caption, features: scene.features, transcript: scene.transcript },
  null,
  2,
);

/** One window's structured notes, typed out once it scrolls into view. */
export const SceneNotes: React.FC = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) return setShown(notesJson.length);
    const id = setInterval(() => setShown(n => (n >= notesJson.length ? (clearInterval(id), n) : n + 7)), 16);
    return () => clearInterval(id);
  }, [inView]);
  const done = shown >= notesJson.length;

  return (
    <div ref={ref} className="grid md:grid-cols-2 gap-4">
      <figure className="border-2 border-charcoal bg-warmWhite">
        {scene.frame && <img src={scene.frame} alt="Still from the sample scene: an ensuite bathroom" className="w-full aspect-video object-cover border-b-2 border-charcoal" />}
        <figcaption className="p-3 font-mono text-[11px] text-olive">
          {data.sample.tour.name} · window {fmtTime(scene.start)}–{fmtTime(scene.end)} · sent as a 360p clip with audio
        </figcaption>
      </figure>
      <div className="border-2 border-charcoal bg-charcoal text-warmWhite p-4 min-h-[16rem] overflow-hidden">
        <p className="font-mono text-[10px] uppercase tracking-widest text-terracotta mb-2">
          {data.models.flash} · responseSchema → JSON
        </p>
        <pre className={`font-mono text-[11px] md:text-xs leading-relaxed whitespace-pre-wrap break-words ${done ? '' : 'caret'}`}>
          {notesJson.slice(0, shown)}
        </pre>
      </div>
    </div>
  );
};

// Diverging colour: slate blue (negative) ← sand (0) → terracotta (positive).
const NEG = [63, 127, 176], MID = [232, 224, 213], POS = [198, 123, 92];
function cellColor(v: number, max: number) {
  const t = Math.max(-1, Math.min(1, v / max));
  const to = t < 0 ? NEG : POS;
  const a = Math.abs(t);
  return `rgb(${MID.map((m, i) => Math.round(m + (to[i] - m) * a)).join(',')})`;
}

const Strip: React.FC<{ label: string; values: number[] }> = ({ label, values }) => {
  const max = Math.max(...values.map(Math.abs)) || 1;
  return (
    <div>
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-charcoal mb-1">{label}</p>
      <div className="flex h-6 border-2 border-charcoal" role="img" aria-label={`${label}: first ${values.length} of ${data.models.dims} dimensions`}>
        {values.map((v, i) => (
          <span key={i} className="flex-1" style={{ background: cellColor(v, max) }} title={`dim ${i}: ${v}`} />
        ))}
      </div>
    </div>
  );
};

const Bar: React.FC<{ label: string; value: number; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-14 font-mono uppercase text-olive">{label}</span>
    <span className="flex-1 h-2 bg-sand">
      {/* Scaled from 0.4 so the narrow band where cosine scores live is visible. */}
      <span className={`grow-x block h-full ${strong ? 'bg-terracotta' : 'bg-charcoal/50'}`} style={{ width: `${Math.max(0, (value - 0.4) / 0.4) * 100}%` }} />
    </span>
    <span className="w-12 text-right font-mono tabular-nums text-charcoal">{value.toFixed(3)}</span>
  </div>
);

/** The query and the scene's two vectors as colour strips, with the cosines they produce. */
export const Embeddings: React.FC = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  const blend = (v: number, s: number) => ranking.visualWeight * v + ranking.speechWeight * s;
  return (
    <div ref={ref} className={`grid lg:grid-cols-5 gap-6 ${inView ? 'in' : ''}`}>
      <div className="lg:col-span-3 min-w-0 space-y-3 bg-warmWhite border-2 border-charcoal p-4">
        <Strip label={`Query · “${vectors.query}”`} values={vectors.queryHead} />
        <Strip label="Clip vector · video + audio, no text" values={vectors.visualHead} />
        <Strip label="Notes vector · caption + features + transcript" values={vectors.speechHead} />
        <p className="font-mono text-[10px] text-olive">
          First {vectors.queryHead.length} of {data.models.dims} dimensions · blue negative, terracotta positive · all vectors L2-normalised, so a dot product is the cosine
        </p>
      </div>
      <div className="lg:col-span-2 min-w-0 space-y-4">
        {[
          { title: `This scene · ${scene.rooms?.join(' → ') ?? scene.room}`, v: vectors.cos.visual, s: vectors.cos.speech, strong: true },
          { title: `Same tour, opening scene · ${vectors.contrast.room}`, v: vectors.contrast.visual, s: vectors.contrast.speech, strong: false },
        ].map(r => (
          <div key={r.title} className="border-2 border-charcoal bg-warmWhite p-3 space-y-1.5">
            <p className="text-sm font-semibold text-charcoal mb-1">{r.title}</p>
            <Bar label="Seen" value={r.v} strong={r.strong} />
            <Bar label="Heard" value={r.s} strong={r.strong} />
            <p className="font-mono text-[11px] text-charcoal/80 pt-1">
              blended = {ranking.visualWeight}·seen + {ranking.speechWeight}·heard = <strong>{blend(r.v, r.s).toFixed(3)}</strong>
              {blend(r.v, r.s) >= ranking.minBlended ? ' ✓ above floor' : ' · below floor'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
