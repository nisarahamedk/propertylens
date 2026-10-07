import React from 'react';

/** A tick for a search part the home meets, a half-filled dot for one it only partly meets. */
const CheckMark: React.FC<{ status: 'yes' | 'partly' | 'no' }> = ({ status }) =>
  status === 'yes' ? (
    <span className="text-[#2F6B3A] font-bold" aria-label="Matches">✓</span>
  ) : status === 'partly' ? (
    <span
      className="inline-block w-3 h-3 shrink-0 rounded-full border-2 border-terracotta bg-[linear-gradient(90deg,#C67B5C_50%,transparent_50%)]"
      aria-label="Partly matches"
    />
  ) : (
    <span className="text-olive/60 font-bold" aria-label="Not found">–</span>
  );

export default CheckMark;
