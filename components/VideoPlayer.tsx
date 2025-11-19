
import React, { useRef, useEffect, useState } from 'react';
import { TranscriptLine } from '../types';

interface VideoPlayerProps {
  videoUrl?: string;
  streamUrl?: string; // Authenticated stream URL from Ragie
  youtubeId?: string;
  startTime: number;
  endTime?: number;
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
  endTime = 0,
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
  const [streamError, setStreamError] = useState<string | null>(null);

  // Keep latest onTimeUpdate in a ref
  const onTimeUpdateRef = useRef(onTimeUpdate);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  // Handle Authenticated Stream (via proxy)
  useEffect(() => {
    let objectUrl: string | null = null;
    let mounted = true;

    const fetchStream = async () => {
      if (!streamUrl) return;

      setStreamError(null);

      try {
        // Fetch video through proxy with auth headers
        const response = await fetch(streamUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.RAGIE_API_KEY}`,
            'partition': 'default'  // Required for chunk content access
          }
        });

        if (!response.ok) {
          if (mounted) {
            setStreamError('Unable to load video stream');
          }
          return;
        }

        if (!mounted) {
          return;
        }

        const blob = await response.blob();

        if (blob.size > 0 && mounted) {
          objectUrl = URL.createObjectURL(blob);
          setAuthenticatedSrc(objectUrl);
        } else if (blob.size === 0) {
          if (mounted) {
            setStreamError('Stream returned empty content');
          }
        }
      } catch (e) {
        if (mounted) {
          setStreamError('Failed to load video stream');
        }
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
            end: endTime > 0 ? Math.ceil(endTime) : undefined,
            autoplay: autoPlay ? 1 : 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            disablekb: 0,
            fs: 1,
            playsinline: 1,
            cc_load_policy: 0,
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
           // Player destroy warning ignored
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
        // Seeking error ignored
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

  // Seek to startTime and stop at endTime for Ragie streams
  useEffect(() => {
    if (authenticatedSrc && videoRef.current) {
      const video = videoRef.current;

      const handleLoadedMetadata = () => {
        if (startTime > 0) {
          video.currentTime = startTime;
        }
        if (autoPlay) {
          video.play().catch(() => {});
        }
      };

      const handleTimeUpdate = () => {
        if (endTime > 0 && video.currentTime >= endTime) {
          video.pause();
          video.currentTime = startTime; // Reset to start for replay
        }
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }
  }, [authenticatedSrc, startTime, endTime, autoPlay]);

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
           Video Stream
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

  // Error State
  if (streamError) {
    return (
      <div className="relative w-full aspect-video bg-charcoal rounded-xl overflow-hidden border-2 border-charcoal shadow-none flex items-center justify-center">
        <div className="text-center p-6">
          <div className="w-12 h-12 mx-auto mb-4 bg-terracotta/20 border-2 border-terracotta flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-terracotta">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-warmWhite font-mono text-sm font-bold uppercase tracking-wide mb-2">Stream Error</p>
          <p className="text-warmWhite/60 font-mono text-xs">{streamError}</p>
        </div>
      </div>
    );
  }

  // No Stream URL - user needs to search
  if (!streamUrl && !videoUrl && !youtubeId) {
    return (
      <div className="relative w-full aspect-video bg-charcoal rounded-xl overflow-hidden border-2 border-charcoal shadow-none flex items-center justify-center">
        <div className="text-center p-6">
          <div className="w-12 h-12 mx-auto mb-4 bg-sand/20 border-2 border-sand flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-sand">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <p className="text-warmWhite font-mono text-sm font-bold uppercase tracking-wide mb-2">No Video Stream</p>
          <p className="text-warmWhite/60 font-mono text-xs">Search for a property to view video clips</p>
        </div>
      </div>
    );
  }

  // Loading State
  if (streamUrl && !authenticatedSrc) {
    return (
      <div className="relative w-full aspect-video bg-charcoal rounded-xl overflow-hidden border-2 border-charcoal shadow-none flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-warmWhite border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <span className="text-warmWhite font-mono text-sm">Loading Stream...</span>
        </div>
      </div>
    );
  }

  // Priority 3: Standard Video URL (YouTube fallback)
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
        <div className="w-full h-full flex items-center justify-center text-white font-mono text-sm">
          <span>Video source unavailable</span>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
