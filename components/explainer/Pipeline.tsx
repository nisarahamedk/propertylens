import React, { useEffect, useRef, useState } from 'react';

export interface Step {
  title: string;
  tech: string;
  what: string;
  example: React.ReactNode;
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A row of pipeline steps (a column on phones). While on screen, the steps light
 * up one after another, as if the example were travelling through them.
 */
const Pipeline: React.FC<{ steps: Step[]; accent?: boolean }> = ({ steps, accent }) => {
  const ref = useRef<HTMLOListElement>(null);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reducedMotion()) return;
    const id = setInterval(() => setActive(a => (a + 1) % steps.length), 2200);
    return () => clearInterval(id);
  }, [visible, steps.length]);

  const still = reducedMotion();
  return (
    <ol ref={ref} className="flex flex-col lg:flex-row lg:items-stretch">
      {steps.map((s, i) => {
        const on = still || i === active;
        return (
          <React.Fragment key={s.title}>
            {i > 0 && (
              <li aria-hidden="true" className="flex items-center justify-center h-6 lg:h-auto lg:w-5 shrink-0">
                <span className={`${accent ? 'flow-accent' : ''} flow-v w-0.5 h-full lg:hidden`} />
                <span className={`${accent ? 'flow-accent' : ''} flow-h h-0.5 w-full hidden lg:block`} />
              </li>
            )}
            <li
              onMouseEnter={() => setActive(i)}
              className={`lg:flex-1 min-w-0 border-2 border-charcoal p-4 flex flex-col gap-3 transition-colors duration-300 ${
                on ? 'bg-warmWhite shadow-neobrutal' : 'bg-warmWhite/60'
              }`}
            >
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-terracotta">
                  {i + 1} · {s.title}
                </p>
                <p className="mt-1 text-sm font-semibold text-charcoal leading-snug">{s.tech}</p>
                <p className="mt-1 text-sm text-charcoal/75 leading-snug">{s.what}</p>
              </div>
              <div className={`mt-auto transition-opacity duration-300 ${on ? 'opacity-100' : 'opacity-40'}`}>{s.example}</div>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
};

export default Pipeline;
