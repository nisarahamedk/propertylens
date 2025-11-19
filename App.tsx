import React, { useState } from 'react';
import LandingView from './views/LandingView';
import ResultsView from './views/ResultsView';
import PlayerView from './views/PlayerView';
import { SearchResult, Property } from './types';

type ViewState = 'LANDING' | 'RESULTS' | 'PLAYER';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('LANDING');
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentView('RESULTS');
  };

  const handleResultClick = (result: SearchResult) => {
    setSelectedResult(result);
    setCurrentView('PLAYER');
  };

  const handlePropertyClick = (property: Property) => {
    // Simulate a search for "overview" of this property or just start playing from 0
    const dummyResult: SearchResult = {
      id: `overview-${property.id}`,
      property: property,
      timestamp: "0:00",
      timestampSeconds: 0,
      transcriptSnippet: "Property Overview",
      visualMatchReason: "Direct Selection",
      thumbnailUrl: property.thumbnailUrl
    };
    handleResultClick(dummyResult);
  };

  const handleBackToResults = () => {
    setCurrentView('RESULTS');
  };

  const handleBackToHome = () => {
    setSearchQuery("");
    setCurrentView('LANDING');
  };

  return (
    <div className="min-h-screen bg-cream font-sans selection:bg-terracotta/20">
      {currentView === 'LANDING' && (
        <LandingView 
          onSearch={handleSearch} 
          onPropertyClick={handlePropertyClick}
        />
      )}

      {currentView === 'RESULTS' && (
        <ResultsView 
          initialQuery={searchQuery} 
          onBack={handleBackToHome}
          onResultClick={handleResultClick}
        />
      )}

      {currentView === 'PLAYER' && selectedResult && (
        <PlayerView 
          result={selectedResult} 
          onBack={handleBackToResults}
          onSeekNewResult={handleResultClick} // Re-using handleResultClick updates the selectedResult state
        />
      )}
    </div>
  );
};

export default App;