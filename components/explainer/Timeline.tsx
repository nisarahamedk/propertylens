import React from 'react';
import { ROOM_ZONE, ZONE_STYLE } from '../../lib/format';
import { data, fmtTime, useInView } from './shared';

const { tour } = data.sample;
const pct = (t: number) => `${(t / tour.duration) * 100}%`;

/** The sample tour's fixed search windows above its timed room chapters. */
const Timeline: React.FC = () => {
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={`bg-warmWhite border-2 border-charcoal p-4 md:p-5 ${inView ? 'in' : ''}`}>
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-olive mb-3">
        <span>{tour.name} · {fmtTime(tour.duration)}</span>
        <span>{tour.windows.length} windows · {tour.chapters.length} chapters</span>
      </div>

      <div className="relative">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-charcoal mb-1">
          Search windows · {data.settings.segment.length}s every {data.settings.segment.step}s
        </p>
        {/* Alternate rows so the 5s overlaps are visible. */}
        <div className="relative h-10 mb-4">
          {tour.windows.map((w, i) => (
            <div
              key={w.start}
              title={`${fmtTime(w.start)}–${fmtTime(w.end)}`}
              className="grow-x absolute h-4 border-2 border-charcoal bg-sand"
              style={{ left: pct(w.start), width: pct(w.end - w.start), top: i % 2 ? 22 : 0, transitionDelay: `${i * 70}ms` }}
            />
          ))}
        </div>

        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-charcoal mb-1">Room chapters · timed from the whole video</p>
        <div className="relative h-9 flex border-2 border-charcoal overflow-hidden">
          {tour.chapters.map((c, i) => (
            <div
              key={c.start}
              title={`${c.label} · ${fmtTime(c.start)}`}
              className={`grow-x h-full border-r border-charcoal/40 last:border-r-0 ${ZONE_STYLE[ROOM_ZONE[c.room]].bg}`}
              style={{ width: pct(c.end - c.start), transitionDelay: `${300 + i * 40}ms` }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 font-mono text-[10px] text-charcoal/80">
          {tour.chapters.filter(c => c.room !== 'other').map(c => (
            <span key={c.start}>{fmtTime(c.start)} {c.label}</span>
          ))}
        </div>

        {/* Playhead across both rows */}
        <div aria-hidden="true" className="sweep absolute top-5 w-0.5 bg-terracotta pointer-events-none" style={{ height: 'calc(100% - 3.25rem)' }} />
      </div>
    </div>
  );
};

export default Timeline;
