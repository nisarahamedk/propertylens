import React, { useState, useEffect, useRef } from 'react';
import { IconSearch, IconClose } from './ui/Icons';

interface SearchBarProps {
  placeholder?: string;
  initialValue?: string;
  onSearch: (query: string) => void;
  className?: string;
  autoFocus?: boolean;
}

const SAMPLE_QUERIES = [
  "modern kitchen with island",
  "backyard with pool and outdoor dining",
  "master bedroom with walk-in closet",
  "open floor plan living room",
  "home office with natural light",
  "renovated bathroom with double vanity"
];

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search across properties...",
  initialValue = "",
  onSearch,
  className = "",
  autoFocus = false
}) => {
  const [query, setQuery] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Animated placeholder typing effect
  useEffect(() => {
    if (query || isFocused) return;

    const currentQuery = SAMPLE_QUERIES[currentSuggestionIndex];
    let timeout: NodeJS.Timeout;

    if (isTyping) {
      if (displayText.length < currentQuery.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentQuery.slice(0, displayText.length + 1));
        }, 35);
      } else {
        timeout = setTimeout(() => {
          setIsTyping(false);
        }, 2000);
      }
    } else {
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, 20);
      } else {
        setCurrentSuggestionIndex((prev) => (prev + 1) % SAMPLE_QUERIES.length);
        setIsTyping(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, isTyping, currentSuggestionIndex, query, isFocused]);

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

  const showAnimatedPlaceholder = !query && !isFocused;

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative group ${className}`}
    >
      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-charcoal pointer-events-none z-10">
        <IconSearch className="w-6 h-6" />
      </div>

      {/* Animated placeholder */}
      {showAnimatedPlaceholder && (
        <div className="absolute left-14 top-1/2 -translate-y-1/2 pointer-events-none z-10 text-olive/60 font-sans font-medium text-xl">
          {displayText}
          <span className="animate-pulse">|</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={isFocused ? placeholder : ''}
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