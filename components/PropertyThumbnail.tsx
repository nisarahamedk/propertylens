import React from 'react';
import { Property } from '../types';

interface PropertyThumbnailProps {
  property: Property;
  onClick: () => void;
}

const PropertyThumbnail: React.FC<PropertyThumbnailProps> = ({ property, onClick }) => {
  return (
    <div 
      className="group relative cursor-pointer flex flex-col"
      onClick={onClick}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-none border-2 border-charcoal bg-sand shadow-neobrutal transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-neobrutal-hover">
        <img 
          src={property.thumbnailUrl} 
          alt={property.name} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 filter grayscale-[20%] group-hover:grayscale-0"
        />
        
        {/* Overlay Button */}
        <div className="absolute inset-0 bg-charcoal/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-center items-center">
           <button className="px-5 py-2 bg-warmWhite text-charcoal border-2 border-charcoal text-xs font-mono font-bold tracking-widest uppercase shadow-neobrutal-sm hover:scale-105 transition-all">
             View Tour
           </button>
        </div>
      </div>
      
      {/* Text Content */}
      <div className="mt-3 px-0.5">
        <div className="flex justify-between items-start mb-2">
            <h3 className="font-display text-lg font-bold text-charcoal leading-tight group-hover:text-terracotta transition-colors uppercase tracking-tight">{property.name}</h3>
        </div>
        <div className="flex justify-between items-center border-t-2 border-charcoal pt-2">
          <p className="text-[11px] text-olive font-mono font-medium uppercase tracking-tight truncate pr-2">
            {property.address}
          </p>
          <p className="text-[10px] text-charcoal font-mono font-bold bg-sand px-1.5 py-0.5 border border-charcoal shrink-0">
            {property.beds}bd/{property.baths}ba
          </p>
        </div>
      </div>
    </div>
  );
};

export default PropertyThumbnail;