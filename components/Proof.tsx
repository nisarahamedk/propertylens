import React from 'react';
import { stem, type Evidence } from '../lib/match';
import Highlight from './Highlight';

const Eye = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const Speech = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
  </svg>
);

type Word = { word: string; note?: string };

/** “green”, “couch” (in the picture): words sharing a note get it once, after the last of them. */
const matched = (words: Word[]) =>
  words
    .map((w, i) => `“${w.word}”${w.note && w.note !== words[i + 1]?.note ? ` (${w.note})` : ''}`)
    .join(', ');

const Line: React.FC<{ icon: React.ReactNode; source: string; words: Word[]; children: React.ReactNode }> = ({ icon, source, words, children }) => (
  <div className="grid gap-0.5">
    <p className="flex flex-wrap items-center gap-x-1.5 font-mono text-[9.5px] font-bold uppercase tracking-widest text-olive">
      <span className="flex items-center gap-1 text-charcoal">{icon}{source}</span>
      {words.length > 0 && <span>· matched {matched(words)}</span>}
    </p>
    <div className="text-[13.5px] leading-snug text-charcoal">{children}</div>
  </div>
);

/**
 * The proof for a match, split by where it came from: what the video shows
 * (the scene description and room name) and what is said in the tour (the transcript).
 */
/**
 * The words a line matched. A phrase that confirms several query words at once
 * reads as one match, in the tour's own words: “black countertops” as “dark countertops”.
 */
function matchedWords(words: string[], phrase: string | undefined, looks: string[], note: (w: string) => string | undefined): Word[] {
  if (!phrase) return words.map(word => ({ word, note: note(word) }));
  const inPhrase = (w: string) => looks.includes(w) || phrase.toLowerCase().includes(stem(w));
  const together = words.filter(inPhrase).join(' ');
  const rest = words.filter(w => !inPhrase(w)).map(word => ({ word, note: note(word) }));
  return [{ word: together, note: phrase.toLowerCase() === together ? undefined : `as “${phrase}”` }, ...rest];
}

/**
 * The proof for a match, split by where it came from: what the video shows
 * (the scene description and room name) and what is said in the tour (the transcript).
 */
const Proof: React.FC<{ evidence: Evidence; clamp?: boolean }> = ({ evidence, clamp }) => {
  const { moment, seen, said, quote, status, looks, seenPhrase, saidPhrase } = evidence;
  // A caption that matched nothing is still worth showing when nothing was said either.
  const showSeen = seen.length > 0 || !quote;
  // Words found only in the room's name ("Ensuite") or the room's still, not in the description.
  const caption = (moment.caption || '').toLowerCase();
  // Colour and material words are marked only as part of the phrase they confirm,
  // not wherever they appear ("black fixtures" next to white countertops).
  const marks = (words: string[]) => words.filter(w => !looks.includes(w)).map(stem);
  // The sentence of the description that shows the most of the search, so a clamped card still shows the match.
  const hits = (t: string) => (seenPhrase && t.includes(seenPhrase) ? 100 : 0) + marks(seen).filter(w => t.toLowerCase().includes(w)).length;
  const scene = (moment.caption || 'Scene from the tour')
    .split(/(?<=[.!?])\s+/)
    .reduce((a, b) => (hits(b) > hits(a) ? b : a));
  const label = (moment.label || '').toLowerCase();
  const note = (word: string) =>
    caption.includes(stem(word)) ? undefined : moment.pictured && !label.includes(stem(word)) ? 'in the picture' : 'room name';
  return (
    <div className="border-l-[3px] border-terracotta pl-2.5 grid gap-2">
      {showSeen && (
        <Line
          icon={<Eye />}
          source={status === 'similar' ? 'Closest scene in the video' : 'Seen in the video'}
          words={matchedWords(seen, seenPhrase, looks, note)}
        >
          <p className={clamp ? 'line-clamp-3' : ''}>
            <Highlight text={scene} terms={marks(seen)} phrases={seenPhrase ? [seenPhrase] : []} />
          </p>
        </Line>
      )}
      {quote && (
        <Line icon={<Speech />} source="Said in the tour" words={matchedWords(said, saidPhrase, looks, () => undefined)}>
          <p className={`italic text-olive ${clamp ? 'line-clamp-2' : ''}`}>
            “<Highlight text={quote} terms={marks(said)} phrases={saidPhrase ? [saidPhrase] : []} />”
          </p>
        </Line>
      )}
    </div>
  );
};

export default Proof;
