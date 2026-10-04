import React, { useState, useEffect, useRef } from 'react';
import { IconSearch, IconClose } from './ui/Icons';

interface SearchBarProps {
  placeholder?: string;
  initialValue?: string;
  onSearch: (query: string) => void;
  className?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

const SAMPLE_QUERIES = [
  "3 bed in Burnaby with a big kitchen island",
  "backyard with mature trees",
  "under $1.5M with mountain views",
  "agent mentions a new roof",
  "bright open living room with high ceilings",
  "walk-in closet in the primary bedroom"
];

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search across properties...",
  initialValue = "",
  onSearch,
  className = "",
  autoFocus = false,
  compact = false
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
    if (query || isFocused || compact) return;

    const currentQuery = SAMPLE_QUERIES[currentSuggestionIndex];
    let timeout: ReturnType<typeof setTimeout>;

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

  const showAnimatedPlaceholder = !query && !isFocused && !compact;

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative group ${className}`}
    >
      <div className={`absolute top-1/2 -translate-y-1/2 text-charcoal pointer-events-none z-10 ${compact ? 'left-3' : 'left-5'}`}>
        <IconSearch className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
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
        placeholder={isFocused || compact ? placeholder : ''}
        aria-label="Search home tours"
        className={`w-full rounded-none bg-warmWhite border-2 border-charcoal text-charcoal placeholder-olive/60 font-sans font-medium focus:outline-none transition-all duration-200 ${
          compact
            ? 'h-11 pl-10 pr-10 text-base shadow-neobrutal-sm focus:shadow-neobrutal'
            : 'h-16 pl-14 pr-12 text-xl shadow-neobrutal focus:shadow-neobrutal-hover focus:translate-x-[-2px] focus:translate-y-[-2px]'
        }`}
      />
      
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/50 hover:text-terracotta transition-colors p-1"
          aria-label="Clear search"
        >
          <IconClose className="w-5 h-5" />
        </button>
      )}
    </form>
  );
};

export default SearchBar;