import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import LandingView from './views/LandingView';
import ResultsView from './views/ResultsView';
import PlayerView from './views/PlayerView';
import IndexView from './views/IndexView';
import AboutView from './views/AboutView';

// Open each new page at the top. Back and forward keep the browser's own scroll position.
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type !== 'POP') window.scrollTo(0, 0);
  }, [pathname, type]);
  return null;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="min-h-screen bg-cream font-sans selection:bg-terracotta/20">
        <Routes>
          <Route path="/" element={<LandingView />} />
          <Route path="/index" element={<IndexView />} />
          <Route path="/about" element={<AboutView />} />
          <Route path="/search" element={<ResultsView />} />
          <Route path="/property/:id" element={<PlayerView />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;
