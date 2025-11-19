import React, { useState, useEffect, useRef } from 'react';
import { IconSearch, IconClose } from './ui/Icons';

interface SearchBarProps {
  placeholder?: string;
  initialValue?: string;
  onSearch: (query: string) => void;
  className?: string;
  autoFocus?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  placeholder = "Search across properties...", 
  initialValue = "", 
  onSearch, 
  className = "",
  autoFocus = false
}) => {
  const [query, setQuery] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className={`relative group ${className}`}
    >
      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-charcoal pointer-events-none z-10">
        <IconSearch className="w-6 h-6" />
      </div>
      
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full h-16 pl-14 pr-12 rounded-none bg-warmWhite border-2 border-charcoal 
                   text-charcoal placeholder-olive/60 font-sans font-medium text-xl
                   shadow-neobrutal focus:shadow-neobrutal-hover focus:translate-x-[-2px] focus:translate-y-[-2px]
                   focus:outline-none transition-all duration-200"
      />
      
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-5 top-1/2 -translate-y-1/2 text-charcoal/50 hover:text-terracotta transition-colors p-1"
          aria-label="Clear search"
        >
          <IconClose className="w-5 h-5" />
        </button>
      )}
    </form>
  );
};

export default SearchBar;