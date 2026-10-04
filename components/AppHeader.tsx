import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconArrowLeft } from './ui/Icons';

const AppHeader: React.FC<{ back?: string | number; children?: React.ReactNode }> = ({ back, children }) => {
  const navigate = useNavigate();
  return (
    <header className="bg-cream border-b-2 border-charcoal sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center gap-4">
        {back !== undefined && (
          <button
            onClick={() => (typeof back === 'number' ? navigate(back) : navigate(back))}
            className="p-2 border-2 border-transparent hover:border-charcoal text-charcoal transition-all"
            aria-label="Back"
          >
            <IconArrowLeft className="w-5 h-5" />
          </button>
        )}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <span className="w-8 h-8 bg-terracotta border-2 border-charcoal flex items-center justify-center">
            <span className="w-3 h-3 bg-warmWhite rounded-full border-2 border-charcoal" />
          </span>
          <span className="font-display text-lg text-charcoal font-bold tracking-tight hidden sm:inline">PropertyLens</span>
        </Link>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </header>
  );
};

export default AppHeader;
