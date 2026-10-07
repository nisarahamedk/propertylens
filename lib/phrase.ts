// Reads a search like "black countertops" as a thing ("countertops") and what
// it should look like ("black"), and checks a caption or quote describes that
// same thing that way: "dark countertops" confirms it, "white quartz
// countertops, black fixtures" contradicts it even though both words appear.
// Shared by the server (to drop contradicted scenes) and the result cards.

import { queryTerms } from './format.js';

// Words that describe how something looks, by kind. A word can sit in more
// than one group ("dark" fits black, grey, brown and navy). Two words agree
// when they share a group; describing words of the same kind that share none
// contradict each other.
const ATTRIBUTES: Record<'colour' | 'material', string[][]> = {
  colour: [
    ['black', 'dark', 'charcoal', 'ebony', 'onyx', 'jet'],
    ['white', 'light', 'cream', 'ivory', 'snow'],
    ['grey', 'gray', 'slate', 'charcoal', 'dark', 'light', 'silver', 'pewter'],
    ['brown', 'dark', 'walnut', 'espresso', 'chocolate', 'chestnut', 'mahogany', 'tan'],
    ['beige', 'tan', 'sand', 'taupe', 'cream', 'light', 'khaki'],
    ['green', 'teal', 'sage', 'olive', 'emerald', 'mint', 'forest', 'turquoise'],
    ['blue', 'navy', 'dark', 'teal', 'aqua', 'turquoise', 'cobalt', 'indigo'],
    ['red', 'burgundy', 'maroon', 'crimson', 'rust'],
    ['pink', 'blush', 'rose', 'salmon'],
    ['yellow', 'gold', 'golden', 'mustard', 'brass'],
    ['orange', 'rust', 'terracotta', 'copper'],
  ],
  material: [
    ['quartz', 'stone'],
    ['quartzite', 'stone'],
    ['granite', 'stone'],
    ['marble', 'stone'],
    ['soapstone', 'stone'],
    ['concrete'],
    ['laminate'],
    ['butcher', 'block', 'wood', 'wooden', 'oak', 'walnut', 'maple', 'hardwood'],
    ['tile', 'tiled'],
    ['leather'],
    ['velvet'],
    ['fabric', 'linen'],
  ],
};

// Names for the same thing, so "couch" finds "sectional sofa".
const SAME_THING = [
  ['couch', 'sofa', 'sectional', 'loveseat', 'settee'],
  ['countertop', 'counter', 'counters', 'countertops', 'worktop'],
  ['cabinet', 'cabinetry', 'cupboard'],
  ['tub', 'bathtub'],
  ['fridge', 'refrigerator'],
  ['stool', 'barstool'],
  ['floor', 'flooring', 'floors'],
  ['backsplash', 'splashback'],
];

type Kind = keyof typeof ATTRIBUTES;

const groupsOf = new Map<string, Map<Kind, Set<number>>>();
for (const kind of Object.keys(ATTRIBUTES) as Kind[]) {
  ATTRIBUTES[kind].forEach((group, i) => {
    for (const w of group) {
      const byKind = groupsOf.get(w) ?? new Map<Kind, Set<number>>();
      byKind.set(kind, (byKind.get(kind) ?? new Set()).add(i));
      groupsOf.set(w, byKind);
    }
  });
}

const stem = (w: string) => (w.length > 4 ? w.replace(/(ing|ed|es|s|er)$/, '') : w);
const sameStem = (word: string, term: string) => {
  const s = stem(term);
  return word.startsWith(s) && word.length - s.length <= 4;
};
const namesFor = (thing: string) => SAME_THING.find(g => g.some(w => sameStem(thing, w) || sameStem(w, thing))) ?? [thing];

export interface ThingQuery {
  thing: string;                       // the last plain word: "countertops"
  looks: { word: string; kind: Kind }[]; // what it should look like: "black"
}

/** "black countertops" -> thing "countertops", looks black. Null when the search names no colour or material. */
export function thingQuery(semantic: string): ThingQuery | null {
  const terms = queryTerms(semantic);
  const looks: ThingQuery['looks'] = [];
  const plain: string[] = [];
  for (const t of terms) {
    const kinds = groupsOf.get(t);
    // "wood" alone is a material; next to a colour it is still a material, so keep the first kind.
    if (kinds) looks.push({ word: t, kind: [...kinds.keys()][0] });
    else plain.push(t);
  }
  if (!looks.length || !plain.length) return null;
  return { thing: plain[plain.length - 1], looks };
}

export interface ThingMatch {
  status: 'confirmed' | 'contradicted' | 'plain' | 'none';
  phrase?: string;     // the words in the text that confirm it, e.g. "dark countertops"
  conflict?: string;   // the words that contradict it, e.g. "white quartz countertops"
}

// A caption describes one thing per clause: "white cabinetry, black countertops, and a tile floor".
const CLAUSE_BREAK = /[,;.!?:()]|\b(?:and|with|paired|featuring|features|feature|alongside|plus|while|that|which|including|includes|next to|beside|under|over)\b/gi;

function clauses(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  let start = 0;
  for (const m of text.matchAll(CLAUSE_BREAK)) {
    out.push({ start, end: m.index! });
    start = m.index! + m[0].length;
  }
  out.push({ start, end: text.length });
  return out.filter(c => c.end > c.start);
}

function agrees(word: string, look: { word: string; kind: Kind }): boolean | null {
  const mine = groupsOf.get(look.word)?.get(look.kind);
  const theirs = groupsOf.get(word)?.get(look.kind);
  if (!mine || !theirs) return null; // not a describing word of this kind
  return [...theirs].some(g => mine.has(g));
}

/** How a piece of text describes the searched thing: confirmed, contradicted, only named, or not at all. */
export function matchThing(text: string, q: ThingQuery): ThingMatch {
  const names = namesFor(q.thing);
  let best: ThingMatch = { status: 'none' };
  for (const c of clauses(text)) {
    const words = [...text.slice(c.start, c.end).matchAll(/[a-z0-9]+/gi)].map(m => ({
      w: m[0].toLowerCase(),
      at: c.start + m.index!,
      end: c.start + m.index! + m[0].length,
    }));
    const head = words.findIndex(x => names.some(n => sameStem(x.w, n)));
    if (head < 0) continue;
    // Only the words in front of the thing describe it ("white quartz countertops").
    const before = words.slice(0, head);
    const agreeing = before.filter(x => q.looks.some(l => agrees(x.w, l) === true));
    const clashing = before.filter(x => q.looks.some(l => agrees(x.w, l) === false));
    const everyLook = q.looks.every(l => before.some(x => agrees(x.w, l) === true));
    if (everyLook) {
      const from = Math.min(...agreeing.map(x => x.at));
      return { status: 'confirmed', phrase: text.slice(from, words[head].end) };
    }
    if (clashing.length && best.status !== 'contradicted') {
      best = { status: 'contradicted', conflict: text.slice(clashing[0].at, words[head].end) };
    } else if (best.status === 'none') {
      best = { status: 'plain', phrase: text.slice(words[head].at, words[head].end) };
    }
  }
  return best;
}
