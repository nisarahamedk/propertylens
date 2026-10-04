import React from 'react';

/** Marks words from the query inside a caption, matching on word stems. */
const Highlight: React.FC<{ text: string; terms: string[]; markClass?: string }> = ({
  text,
  terms,
  markClass = 'bg-terracotta/20 text-charcoal',
}) => {
  if (!terms.length) return <>{text}</>;
  const stems = terms.map(t => (t.length > 4 ? t.replace(/(es|s|ing|ed)$/, '') : t));
  const parts = text.split(/(\b[\w'-]+\b)/);
  return (
    <>
      {parts.map((part, i) => {
        const lower = part.toLowerCase();
        const hit = stems.some(s => lower.startsWith(s) && lower.length - s.length <= 3);
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
