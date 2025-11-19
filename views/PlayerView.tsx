
import React, { useState, useMemo, useRef, useEffect } from 'react';
import VideoPlayer from '../components/VideoPlayer';
import { SearchResult, Property, TranscriptLine, VideoData } from '../types';
import { getPropertyDetails, generateGroundedResponse } from '../services/searchService';
import { IconArrowLeft, IconSearch } from '../components/ui/Icons';

interface PlayerViewProps {
  result: SearchResult;
  onBack: () => void;
  onSeekNewResult: (result: SearchResult) => void;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const PlayerView: React.FC<PlayerViewProps> = ({ result, onBack, onSeekNewResult }) => {
  const [currentTime, setCurrentTime] = useState(result.timestampSeconds);
  const [followUpQuery, setFollowUpQuery] = useState("");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDetails = async () => {
      setIsLoadingDetails(true);
      try {
        const data = await getPropertyDetails(result.property.id);
        setVideoData(data);
      } catch (e) {
        console.error("Failed to load property details", e);
      } finally {
        setIsLoadingDetails(false);
      }
    };
    loadDetails();
  }, [result.property.id]);

  const transcripts = videoData ? videoData.transcripts : [];
  const otherMoments = videoData ? videoData.moments : [];

  // Find active transcript line
  const activeTranscriptIndex = useMemo(() => {
    return transcripts.findIndex((line, idx) => {
      const nextLine = transcripts[idx + 1];
      return currentTime >= line.timestampSeconds && (!nextLine || currentTime < nextLine.timestampSeconds);
    });
  }, [currentTime, transcripts]);

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleTranscriptClick = (seconds: number) => {
    const newRes = { ...result, timestampSeconds: seconds };
    onSeekNewResult(newRes);
  };
  
  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping]);

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpQuery.trim()) return;

    const userMsg = followUpQuery;
    setFollowUpQuery("");
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    // Prepare Context
    const description = result.property.description;
    const transcriptText = transcripts.map(t => t.text).join(" ");
    const fullContext = `PROPERTY DESCRIPTION: ${description}\n\nVIDEO TRANSCRIPT: ${transcriptText}`;

    try {
      const responseText = await generateGroundedResponse(userMsg, fullContext);
      setChatMessages(prev => [...prev, { role: 'assistant', text: responseText }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: "I'm having trouble connecting to the service right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col animate-fade-in">
       {/* Header */}
       <header className="bg-cream sticky top-0 z-40 border-b-2 border-charcoal">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center relative">
          <button 
            onClick={onBack}
            className="absolute left-4 flex items-center gap-2 text-charcoal hover:text-terracotta transition-colors"
          >
            <div className="p-2 border-2 border-charcoal bg-warmWhite hover:bg-charcoal hover:text-warmWhite transition-all shadow-neobrutal-sm">
              <IconArrowLeft className="w-4 h-4" />
            </div>
            <span className="hidden sm:inline font-mono font-bold text-xs uppercase tracking-wider">Back</span>
          </button>
          
          <div className="w-full text-center">
             <span className="font-mono text-olive/60 text-xs font-bold uppercase tracking-widest mr-2">Viewing</span>
             <span className="font-display text-lg text-terracotta font-bold uppercase tracking-wide border-b-2 border-terracotta/30 pb-0.5">
               {result.property.name}
             </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 lg:py-10 flex flex-col lg:flex-row gap-8 w-full">
        {/* Left Column: Player */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="bg-black shadow-neobrutal-lg mb-8 relative group border-2 border-charcoal">
            <VideoPlayer 
              videoUrl={result.property.videoUrl}
              streamUrl={result.streamUrl}
              youtubeId={result.property.youtubeId}
              startTime={result.timestampSeconds}
              transcripts={transcripts}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>

          <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
             <h1 className="font-display text-4xl md:text-5xl text-charcoal mb-4 font-bold uppercase tracking-tight leading-none">
               {result.property.name}
             </h1>
             
             {/* Metadata Tags */}
             <div className="flex flex-wrap items-center gap-4 mb-8 border-b-2 border-charcoal pb-8">
               <span className="inline-block bg-clay/30 text-charcoal border-2 border-charcoal px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider">
                 {result.property.address}
               </span>
               <div className="text-xs font-mono font-bold tracking-widest text-olive/80 uppercase flex items-center gap-3">
                 <span>{result.property.beds} Bed</span>
                 <span className="text-charcoal/30">/</span>
                 <span>{result.property.baths} Bath</span>
                 <span className="text-charcoal/30">/</span>
                 <span>{result.property.sqft} SqFt</span>
               </div>
             </div>
             
             <p className="text-charcoal text-lg leading-relaxed max-w-3xl font-sans font-medium text-opacity-80">
               {result.property.description}
             </p>

             {/* Key Moments */}
             <div className="mt-12">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-1.5 h-6 bg-terracotta"></div>
                  <h3 className="text-xs font-bold text-charcoal font-mono uppercase tracking-widest">Key Moments</h3>
                </div>
                
                {isLoadingDetails ? (
                  <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4">
                    {[1,2,3].map(i => (
                       <div key={i} className="w-48 h-24 bg-clay/20 border-2 border-charcoal/10 animate-pulse shrink-0"></div>
                    ))}
                  </div>
                ) : otherMoments.length > 0 ? (
                  <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-4">
                    {otherMoments.map((moment) => (
                      <button
                        key={moment.id}
                        onClick={() => handleTranscriptClick(moment.timestampSeconds)}
                        className={`group flex-shrink-0 px-5 py-4 border-2 transition-all w-48 text-left relative
                          ${currentTime >= moment.timestampSeconds && currentTime < moment.timestampSeconds + 20 
                            ? 'bg-warmWhite text-charcoal border-charcoal shadow-neobrutal translate-x-[-2px] translate-y-[-2px]' 
                            : 'bg-warmWhite border-charcoal/20 text-olive hover:border-charcoal hover:shadow-neobrutal-sm'}`}
                      >
                        <span className={`block text-[10px] font-mono font-bold uppercase mb-2 ${currentTime >= moment.timestampSeconds && currentTime < moment.timestampSeconds + 20 ? 'text-terracotta' : 'text-olive/60'}`}>
                          {moment.timestamp}
                        </span>
                        <span className="block font-display text-xl font-bold leading-none">{moment.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-mono text-olive/60 italic">No key moments indexed for this property.</p>
                )}
             </div>
          </div>
        </div>

        {/* Right Column: Transcript & Chat */}
        <div className="w-full lg:w-[400px] shrink-0 flex flex-col h-[600px] lg:h-[calc(100vh-140px)] lg:sticky lg:top-24 border-2 border-charcoal shadow-neobrutal bg-warmWhite">
          
          {/* Transcript Header */}
          <div className="p-4 border-b-2 border-charcoal bg-sand/30 flex justify-between items-center shrink-0">
            <h3 className="font-display font-bold text-lg text-charcoal uppercase tracking-tight">Transcript</h3>
            <div className="px-2 py-1 border border-charcoal bg-white text-[10px] font-mono font-bold text-charcoal uppercase tracking-wider shadow-[2px_2px_0_0_#1A261B]">Auto-Scroll</div>
          </div>

          {/* Transcript List (Flex-1 to take available space) */}
          <div className={`overflow-y-auto p-0 flex-1 bg-warmWhite transition-all duration-300 ${chatMessages.length > 0 ? 'basis-1/3' : 'basis-2/3'}`}>
            {isLoadingDetails ? (
              <div className="p-4 space-y-4">
                 {[1,2,3,4,5].map(i => (
                   <div key={i} className="animate-pulse">
                      <div className="h-3 w-12 bg-clay/30 mb-2"></div>
                      <div className="h-4 w-full bg-clay/20"></div>
                      <div className="h-4 w-3/4 bg-clay/20 mt-1"></div>
                   </div>
                 ))}
              </div>
            ) : transcripts.length > 0 ? (
              transcripts.map((line, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleTranscriptClick(line.timestampSeconds)}
                  className={`group cursor-pointer p-4 transition-all duration-200 border-b border-charcoal/5 hover:bg-sand/30 ${
                    idx === activeTranscriptIndex 
                      ? 'bg-sand/50' 
                      : ''
                  }`}
                >
                  <div className="flex gap-3">
                     <span className={`text-[10px] font-mono font-bold mt-1 ${idx === activeTranscriptIndex ? 'text-terracotta' : 'text-olive/40'}`}>
                       {line.timestamp}
                     </span>
                     <p className={`text-sm font-sans leading-relaxed ${idx === activeTranscriptIndex ? 'font-bold text-charcoal' : 'text-charcoal/70'}`}>
                       {line.text}
                     </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                 <p className="text-sm font-mono text-olive/60">Transcript unavailable for this video.</p>
              </div>
            )}
          </div>

          {/* Chat / Follow-up Section */}
          <div className={`border-t-2 border-charcoal bg-charcoal flex flex-col transition-all duration-300 ${chatMessages.length > 0 ? 'basis-2/3' : 'basis-auto'}`}>
            
            {/* Chat History - Only visible if there are messages */}
            {chatMessages.length > 0 && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-charcoal border-b border-white/10 custom-scrollbar">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
                    <div className={`max-w-[90%] p-3 border-2 ${
                      msg.role === 'user' 
                        ? 'bg-terracotta border-terracotta text-white rounded-tr-none rounded-lg' 
                        : 'bg-warmWhite border-warmWhite text-charcoal rounded-tl-none rounded-lg'
                    }`}>
                      <p className="text-sm font-sans font-medium leading-snug">{msg.text}</p>
                    </div>
                    <span className="text-[10px] font-mono text-white/40 mt-1 uppercase tracking-wider">
                      {msg.role === 'user' ? 'You' : 'Assistant'}
                    </span>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-start animate-fade-in">
                    <div className="bg-warmWhite/10 border border-warmWhite/20 p-3 rounded-lg rounded-tl-none">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce delay-100"></div>
                        <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* Input Area */}
            <div className="p-5 shrink-0">
              <h3 className="font-display text-2xl font-bold mb-1 text-warmWhite uppercase tracking-tight">Ask follow-up</h3>
              <p className="text-xs font-mono text-warmWhite/60 mb-4">Ask about specific details in this video.</p>
              <form onSubmit={handleFollowUpSubmit} className="relative z-10 group">
                <input 
                  type="text"
                  value={followUpQuery}
                  onChange={(e) => setFollowUpQuery(e.target.value)}
                  placeholder="Does this house have a pool?"
                  className="w-full h-12 pl-4 pr-12 rounded-none bg-warmWhite/10 border-2 border-warmWhite/20 text-warmWhite placeholder-warmWhite/30 focus:outline-none focus:border-terracotta focus:bg-warmWhite/20 transition-all text-sm font-mono"
                />
                <button 
                  type="submit" 
                  disabled={!followUpQuery.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-warmWhite/40 hover:text-terracotta transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <IconSearch className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default PlayerView;
