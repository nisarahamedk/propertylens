import React from 'react';
import type { Moment, PropertyMatch } from '../types';
import { formatPrice, formatTime, queryTerms, ROOM_LABELS } from '../lib/format';
import { capitalize, checkHome, evidenceFor, homeTitle, shortCheck, stem, type SearchPart } from '../lib/match';
import Highlight from './Highlight';
import CheckMark from './CheckMark';

interface MatchCardProps {
  match: PropertyMatch;
  parts: SearchPart[];
  semantic: string;
  onOpen: (moment?: Moment) => void;
}

/** One home in the results: the parts of the search it meets, and the moment that proves it. */
const MatchCard: React.FC<MatchCardProps> = ({ match, parts, semantic, onOpen }) => {
  const p = match.property;
  const evidence = evidenceFor(match.moments, semantic);
  const checks = checkHome(p, parts, evidence);
  const complete = checks.every(c => c.status === 'yes');
  const moment = evidence?.moment;
  const terms = (evidence ? evidence.found : queryTerms(semantic)).map(stem);
  const price = formatPrice(p.priceValue);

  return (
    <button
      onClick={() => onOpen(moment)}
      className={`group w-full h-full text-left bg-warmWhite border-2 border-charcoal flex flex-col md:flex-row hover:shadow-neobrutal-hover hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta ${
        complete ? '' : 'border-dashed'
      }`}
    >
      <div className="relative shrink-0 md:w-[44%] bg-sand border-b-2 md:border-b-0 md:border-r-2 border-charcoal overflow-hidden">
        <img
          src={moment?.frame || p.thumbnailUrl}
          alt=""
          loading="lazy"
          className="w-full aspect-[2/1] md:aspect-auto md:h-full md:min-h-[190px] object-cover"
        />
        {moment && (
          <span className="absolute left-2 bottom-2 flex gap-1.5">
            <span className="bg-terracotta text-white text-[11px] font-mono font-bold px-1.5 py-0.5">▶ {formatTime(moment.start)}</span>
            <span className="bg-charcoal text-warmWhite text-[10px] font-mono font-bold px-1.5 py-0.5 uppercase">
              {moment.label ?? ROOM_LABELS[moment.room]}
            </span>
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0 p-3 md:p-4 grid grid-cols-[minmax(0,1fr)] gap-2 content-start">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display font-bold text-base md:text-lg text-charcoal truncate">{homeTitle(p)}</h3>
          <span className="shrink-0 font-mono font-bold text-sm text-charcoal">
            {price || <span className="font-normal text-xs text-olive">No price</span>}
          </span>
        </div>

        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
          {checks.map(c => (
            <li key={c.part.label} className="flex items-center gap-1 whitespace-nowrap">
              <CheckMark status={c.status} />
              {c.part.source === 'video' ? (
                c.status === 'yes' ? (
                  <b className="font-semibold">{shortCheck(c)}</b>
                ) : evidence?.status === 'partly' ? (
                  <span><b className="font-semibold">{capitalize(evidence.found.join(' '))}</b>, “{evidence.missing.join(' ')}” not confirmed</span>
                ) : (
                  <span>Closest to <b className="font-semibold">{c.part.label}</b></span>
                )
              ) : (
                shortCheck(c)
              )}
            </li>
          ))}
        </ul>

        {moment ? (
          <div className="border-l-[3px] border-terracotta pl-2.5 text-[13.5px] leading-snug text-charcoal">
            <p className="line-clamp-3">
              <Highlight text={moment.caption || 'Scene from the tour'} terms={terms} />
            </p>
            {evidence?.quote && (
              <p className="hidden md:block mt-1 italic text-olive line-clamp-2">
                “<Highlight text={evidence.quote} terms={terms} />”
              </p>
            )}
            <p className="mt-1 font-mono text-[9px] font-bold uppercase tracking-widest text-olive">
              {evidence?.how === 'Closest match' ? 'Closest moment in the tour' : `${evidence?.how} in the tour`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-olive line-clamp-3">{p.description}</p>
        )}
      </div>
    </button>
  );
};

export default MatchCard;
