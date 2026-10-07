import React from 'react';

/**
 * Marks query words inside a caption, matching on word stems, and whole
 * phrases that matched the search ("dark countertops") as one mark.
 */
const Highlight: React.FC<{ text: string; terms: string[]; phrases?: string[]; markClass?: string }> = ({
  text,
  terms,
  phrases = [],
  markClass = 'bg-terracotta/20 text-charcoal',
}) => {
  const wanted = phrases.filter(p => p && text.includes(p));
  if (!terms.length && !wanted.length) return <>{text}</>;
  const stems = terms.map(t => (t.length > 4 ? t.replace(/(es|s|ing|ed)$/, '') : t));
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const split = new RegExp(`(${[...wanted.map(escape), "\\b[\\w'-]+\\b"].join('|')})`);
  const parts = text.split(split);
  return (
    <>
      {parts.map((part, i) => {
        const lower = part.toLowerCase();
        const hit = wanted.includes(part) || stems.some(s => lower.startsWith(s) && lower.length - s.length <= 3);
        return hit ? (
          <mark key={i} className={`${markClass} px-0.5`}>{part}</mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        );
      })}
    </>
  );
};

export default Highlight;
