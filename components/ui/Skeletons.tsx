import React from 'react';

export const ResultCardSkeleton = () => (
  <div className="group relative bg-warmWhite p-4 sm:p-6 border-2 border-charcoal shadow-neobrutal animate-pulse">
    <div className="flex flex-col md:flex-row gap-6">
      {/* Thumbnail */}
      <div className="relative shrink-0 w-full md:w-[300px] lg:w-[340px] aspect-video overflow-hidden border-2 border-charcoal/10 bg-clay/20">
         <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      </div>
      {/* Content */}
      <div className="flex-1 flex flex-col space-y-4">
         <div className="h-8 w-2/3 bg-clay/30" />
         <div className="h-4 w-1/2 bg-clay/20" />
         <div className="relative my-1 pl-4 border-l-4 border-clay/30 py-2">
           <div className="h-16 w-full bg-clay/10" />
         </div>
         <div className="mt-auto flex justify-between pt-2">
            <div className="h-4 w-1/4 bg-clay/20" />
            <div className="h-8 w-24 bg-charcoal/10" />
         </div>
      </div>
    </div>
  </div>
);
