import React from 'react';
import type { Property } from '../types';
import { formatPrice, formatTime } from '../lib/format';
import { coverImage, homeTitle } from '../lib/match';

interface PropertyThumbnailProps {
  property: Property;
  onClick: () => void;
}

/** A tour card: a clean room still from the tour, then where, how much and how big. */
const PropertyThumbnail: React.FC<PropertyThumbnailProps> = ({ property, onClick }) => {
  const rooms = property.chapters?.length ?? 0;
  const price = formatPrice(property.priceValue);
  const facts = [
    property.beds ? `${property.beds} bed` : null,
    property.baths ? `${property.baths} bath` : null,
    property.address !== property.location ? property.location : null,
  ].filter(Boolean);

  return (
    <button onClick={onClick} className="group min-w-0 text-left flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta">
      <div className="relative w-full aspect-[4/3] overflow-hidden border-2 border-charcoal bg-sand transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-neobrutal-hover">
        <img src={coverImage(property)} alt="" loading="lazy" className="w-full h-full object-cover" />
        <span className="absolute right-1.5 bottom-1.5 bg-charcoal text-warmWhite font-mono text-[10px] font-bold px-1.5 py-0.5">
          {formatTime(property.duration)}{rooms ? ` · ${rooms} rooms` : ''}
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2 min-w-0 w-full">
        <h3 className="truncate font-semibold text-[13px] md:text-[15px] text-charcoal group-hover:text-terracotta transition-colors">
          {homeTitle(property)}
        </h3>
        {price && <span className="shrink-0 font-mono font-bold text-xs md:text-sm text-charcoal">{price}</span>}
      </div>
      {facts.length > 0 && (
        <p className="mt-0.5 truncate w-full font-mono text-[10px] font-bold uppercase tracking-widest text-olive">{facts.join(' · ')}</p>
      )}
    </button>
  );
};

export default PropertyThumbnail;
