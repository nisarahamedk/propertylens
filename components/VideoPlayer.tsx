
import React, { useRef, useEffect, useState } from 'react';
import { TranscriptLine } from '../types';

interface VideoPlayerProps {
  videoUrl?: string;
  streamUrl?: string; // Authenticated stream URL from Ragie
  youtubeId?: string;
  startTime: number;
  autoPlay?: boolean;
  transcripts?: TranscriptLine[];
  onTimeUpdate?: (time: number) => void;
}

declare global {
  interface Window {
    YT: any;
  }
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  videoUrl, 
  streamUrl,
  youtubeId,
  startTime, 
  autoPlay = true, 
  transcripts = [],
  onTimeUpdate
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Generate a stable unique ID for this player instance
  const [playerId] = useState(() => `youtube-player-${Math.random().toString(36).substr(2, 9)}`);
  const [isYoutubeError, setIsYoutubeError] = useState(false);
  const [authenticatedSrc, setAuthenticatedSrc] = useState<string | null>(null);

  // Keep latest onTimeUpdate in a ref
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  // Handle Authenticated Stream (Ragie Proxy Logic on Client)
  useEffect(() => {
    let objectUrl: string | null = null;
    let mounted = true;

    const fetchStream = async () => {
      if (!streamUrl || !process.env.RAGIE_API_KEY) return;
      
      try {
        // Fetch the video data with the API key header
        const response = await fetch(streamUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.RAGIE_API_KEY}`
          }
        });
        
        if (response.ok && mounted) {
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          setAuthenticatedSrc(objectUrl);
        }
      } catch (e) {
        console.error("Error fetching authenticated stream", e);
      }
    };

    if (streamUrl) {
      fetchStream();
    } else {
      setAuthenticatedSrc(null);
    }

    return () => {
      mounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [streamUrl]);

  // YouTube API Integration
  useEffect(() => {
    if (!youtubeId || isYoutubeError || streamUrl) return;

    let playerInstance: any = null;
    let timeInterval: any = null;
    let checkInterval: any = null;
    let isMounted = true;
    let isInitializing = false;

    const initPlayer = () => {
      if (!isMounted || isInitializing) return;
      
      // Safety check: ensure element exists and API is ready
      const el = document.getElementById(playerId);
      if (!el || !window.YT || !window.YT.Player) return;

      isInitializing = true;

      try {
        playerInstance = new window.YT.Player(playerId, {
          videoId: youtubeId,
          width: '100%',
          height: '100%',
          playerVars: {
            start: Math.floor(startTime),
            autoplay: autoPlay ? 1 : 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin || 'http://localhost'
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              playerRef.current = event.target;
              if (autoPlay) {
                event.target.playVideo();
              }
            },
            onError: (e: any) => {
              console.warn("YouTube Player Error:", e.data);
              if (isMounted) setIsYoutubeError(true);
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              
              // Playing state
              if (event.data === window.YT.PlayerState.PLAYING) {
                if (timeInterval) clearInterval(timeInterval);
                timeInterval = setInterval(() => {
                  if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                    try {
                      const currentTime = playerRef.current.getCurrentTime();
                      if (onTimeUpdateRef.current) {
                        onTimeUpdateRef.current(currentTime);
                      }
                    } catch (e) {
                      // Ignore errors from seeking/loading states
                    }
                  }
                }, 500);
              } else {
                if (timeInterval) clearInterval(timeInterval);
              }
            }
          }
        });
      } catch (err) {
        console.error("Error initializing YouTube player", err);
        if (isMounted) setIsYoutubeError(true);
      }
    };

    // Logic to load API
    if (!window.YT || !window.YT.Player) {
      // Add script if missing
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      // Robust polling instead of onYouTubeIframeAPIReady
      checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkInterval);
          initPlayer();
        }
      }, 200);
    } else {
      initPlayer();
    }

    return () => {
      isMounted = false;
      if (timeInterval) clearInterval(timeInterval);
      if (checkInterval) clearInterval(checkInterval);
      
      // Proper cleanup
      if (playerInstance) {
        try {
          // Some versions of YT API throw if you destroy too early, so we wrap in try/catch
          if (typeof playerInstance.destroy === 'function') {
            playerInstance.destroy();
          }
        } catch(e) {
           console.debug("Player destroy warning", e);
        }
      }
      playerRef.current = null;
    };
  }, [youtubeId, playerId, isYoutubeError, streamUrl]);

  // Handle Seeking
  useEffect(() => {
    // Only seek if NOT using a streamUrl (streams usually start at the clip start)
    if (streamUrl) return;

    if (youtubeId && !isYoutubeError && playerRef.current && typeof playerRef.current.seekTo === 'function') {
      try {
        const currentTime = typeof playerRef.current.getCurrentTime === 'function' 
          ? playerRef.current.getCurrentTime() 
          : -1;
        
        if (Math.abs(currentTime - startTime) > 2) {
          playerRef.current.seekTo(startTime, true);
          if (autoPlay) {
              playerRef.current.playVideo();
          }
        }
      } catch (e) {
        console.warn("Error seeking YouTube video", e);
      }
    }
  }, [startTime, youtubeId, isYoutubeError, autoPlay, streamUrl]);

  // HTML5 Time Update
  const handleHTML5TimeUpdate = () => {
    if (videoRef.current && onTimeUpdateRef.current) {
      onTimeUpdateRef.current(videoRef.current.currentTime);
    }
  };

  // Handle HTML5 Seeking
  useEffect(() => {
    // Only seek if NOT using a streamUrl (streams usually start at the clip start)
    if (streamUrl) return;

    if ((!youtubeId || isYoutubeError) && videoRef.current) {
      const currentTime = videoRef.current.currentTime;
      if (Math.abs(currentTime - startTime) > 1) {
        videoRef.current.currentTime = startTime;
        if (autoPlay) {
          videoRef.current.play().catch(() => {});
        }
      }
    }
  }, [startTime, youtubeId, isYoutubeError, autoPlay, streamUrl]);

  // Priority 1: Authenticated Stream from Ragie
  if (authenticatedSrc) {
    return (
       <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border-2 border-charcoal shadow-none">
        <video
          ref={videoRef}
          src={authenticatedSrc}
          className="w-full h-full object-cover"
          controls
          playsInline
          autoPlay={autoPlay}
          onTimeUpdate={handleHTML5TimeUpdate}
        />
        <div className="absolute top-3 left-3 bg-terracotta text-white text-[10px] font-mono px-2 py-1 rounded-none border-2 border-charcoal pointer-events-none uppercase font-bold">
           Ragie Stream
         </div>
      </div>
    )
  }

  // Priority 2: YouTube
  if (youtubeId && !isYoutubeError && !streamUrl) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border-2 border-charcoal shadow-none group">
        <div ref={containerRef} className="w-full h-full">
             <div id={playerId} className="w-full h-full"></div>
        </div>
      </div>
    );
  }

  // Priority 3: Standard Video URL
  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border-2 border-charcoal shadow-none">
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-cover"
          controls
          playsInline
          autoPlay={autoPlay}
          onTimeUpdate={handleHTML5TimeUpdate}
          crossOrigin="anonymous"
        >
          Your browser does not support the video tag.
        </video>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white font-mono text-sm flex-col gap-2">
           {streamUrl ? (
             <>
               <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
               <span>Loading Stream...</span>
             </>
           ) : (
             <span>Video source unavailable</span>
           )}
        </div>
      )}
      
      {isYoutubeError && videoUrl && (
         <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white/80 text-[10px] font-mono px-2 py-1 rounded border border-white/10 pointer-events-none">
           Fallback Source
         </div>
      )}
    </div>
  );
};

export default VideoPlayer;
