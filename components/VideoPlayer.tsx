import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface VideoPlayerProps {
  youtubeId: string;
  startTime?: number;
  onTimeUpdate?: (time: number) => void;
}

declare global {
  interface Window {
    YT: any;
  }
}

let apiPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise(resolve => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    const check = setInterval(() => {
      if (window.YT?.Player) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
  return apiPromise;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({ youtubeId, startTime = 0, onTimeUpdate }, ref) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const pendingSeek = useRef<number | null>(null);
  const onTimeRef = useRef(onTimeUpdate);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onTimeRef.current = onTimeUpdate;
  }, [onTimeUpdate]);

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      const p = playerRef.current;
      if (p?.seekTo) {
        p.seekTo(seconds, true);
        p.playVideo?.();
        onTimeRef.current?.(seconds);
      } else {
        pendingSeek.current = seconds;
      }
    },
  }));

  useEffect(() => {
    let disposed = false;
    let ticker: ReturnType<typeof setInterval> | undefined;
    setFailed(false);

    loadYouTubeApi().then(() => {
      if (disposed || !hostRef.current) return;
      const mount = document.createElement('div');
      hostRef.current.innerHTML = '';
      hostRef.current.appendChild(mount);
      playerRef.current = new window.YT.Player(mount, {
        videoId: youtubeId,
        width: '100%',
        height: '100%',
        playerVars: {
          start: Math.floor(startTime),
          autoplay: 1,
          mute: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: any) => {
            if (pendingSeek.current !== null) {
              e.target.seekTo(pendingSeek.current, true);
              pendingSeek.current = null;
            }
            e.target.playVideo();
            ticker = setInterval(() => {
              const t = playerRef.current?.getCurrentTime?.();
              if (typeof t === 'number') onTimeRef.current?.(t);
            }, 250);
          },
          onError: () => !disposed && setFailed(true),
        },
      });
    });

    return () => {
      disposed = true;
      if (ticker) clearInterval(ticker);
      try {
        playerRef.current?.destroy?.();
      } catch {
        // The API throws if destroyed before it finished initialising.
      }
      playerRef.current = null;
    };
    // startTime only matters for the first load; later jumps go through seekTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId]);

  return (
    <div className="relative w-full aspect-video bg-charcoal overflow-hidden">
      <div ref={hostRef} className="absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full" />
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-charcoal">
          <p className="text-warmWhite font-mono text-sm font-bold uppercase tracking-wide mb-2">Video unavailable</p>
          <p className="text-warmWhite/60 font-mono text-xs mb-4">The owner may have removed it from YouTube.</p>
          <a
            href={`https://www.youtube.com/watch?v=${youtubeId}&t=${Math.floor(startTime)}s`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-warmWhite text-charcoal border-2 border-charcoal font-mono text-xs font-bold uppercase"
          >
            Try on YouTube
          </a>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
