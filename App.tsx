import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingView from './views/LandingView';
import ResultsView from './views/ResultsView';
import PlayerView from './views/PlayerView';
import IndexView from './views/IndexView';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-cream font-sans selection:bg-terracotta/20">
        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/index" element={<IndexView />} />
          <Route path="/search" element={<ResultsView />} />
          <Route path="/property/:documentId/:chunkId" element={<PlayerView />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
