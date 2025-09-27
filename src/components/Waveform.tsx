import React, { useEffect, useRef, useState } from 'react';

type Props = {
  audioUrl: string;
  selection?: { start: number | null; end: number | null };
  onSelectionChange?: (start: number | null, end: number | null) => void;
  onWaveformReady?: () => void;
  expectedDuration?: number; // fallback duration (e.g., from metadata)
};

const Waveform: React.FC<Props> = ({ audioUrl, selection, onSelectionChange, onWaveformReady, expectedDuration }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.25);
  const [isMuted, setIsMuted] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);

  // Set initial volume when audio loads
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : volume;
    }
  }, [audioUrl, volume, isMuted]);

  // Set duration from expectedDuration on mount
  useEffect(() => {
    if (expectedDuration && isFinite(expectedDuration) && expectedDuration > 0 && duration === 0) {
      console.log('🎛️ WAVEFORM PLAYER: Setting duration from expectedDuration', expectedDuration);
      setDuration(expectedDuration);
    }
  }, [expectedDuration, duration]);

  // AUDIO EVENT HANDLERS - EXACT COPY FROM PREVIEW PLAYER
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;
      setCurrentTime(currentTime);
    };
    
    const handleDurationChange = () => {
      console.log('🎛️ WAVEFORM PLAYER: handleDurationChange', {
        duration: audio.duration,
        isFinite: isFinite(audio.duration),
        isNaN: isNaN(audio.duration),
        id: audio.id
      });
      
      // Only set duration if it's a valid finite number
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        console.log('🎛️ WAVEFORM PLAYER: Duration set to', audio.duration);
      } else {
        console.log('🎛️ WAVEFORM PLAYER: Invalid duration, keeping current value');
      }
    };
    
    const handleLoadedMetadata = () => {
      console.log('🎛️ WAVEFORM PLAYER: handleLoadedMetadata', {
        duration: audio.duration,
        isFinite: isFinite(audio.duration),
        expectedDuration,
        id: audio.id
      });
      
      if (isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
        console.log('🎛️ WAVEFORM PLAYER: Duration set from loadedmetadata to', audio.duration);
      } else if (expectedDuration && isFinite(expectedDuration) && expectedDuration > 0) {
        setDuration(expectedDuration);
        console.log('🎛️ WAVEFORM PLAYER: Duration set from expectedDuration to', expectedDuration);
      }
    };
    
    const handlePlay = () => {
      console.log('🎛️ WAVEFORM PLAYER: handlePlay', {
        id: audio.id,
        currentTime: audio.currentTime,
        duration: audio.duration,
        isPlaying
      });
      setIsPlaying(true);
    };
    
    const handlePause = () => {
      console.log('🎛️ WAVEFORM PLAYER: handlePause', {
        id: audio.id,
        currentTime: audio.currentTime,
        duration: audio.duration,
        isPlaying
      });
      setIsPlaying(false);
    };
    
    const handleEnded = () => {
      console.log('🎛️ WAVEFORM PLAYER: handleEnded', {
        id: audio.id,
        currentTime: audioRef.current?.currentTime,
        duration: audioRef.current?.duration,
        isPlaying
      });
      setIsPlaying(false);
      // Don't reset audio position - let user control it
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl, expectedDuration, isPlaying]);

  // PLAYER FUNCTIONS - EXACT COPY FROM PREVIEW PLAYER
  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    console.log('🎛️ WAVEFORM PLAYER: togglePlayPause called', {
      isPlaying,
      currentTime: audio.currentTime,
      duration: audio.duration,
      src: audio.src?.split('/').pop(),
      id: audio.id
    });
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Check if track has ended (currentTime is at or very close to duration)
      const isAtEnd = audio.currentTime >= (duration - 0.1);
      
      if (isAtEnd) {
        console.log('🎛️ WAVEFORM PLAYER: Track ended, restarting from beginning');
        audio.currentTime = 0;
        setCurrentTime(0);
      }
      
      // Check if audio is ready
      console.log('Audio readyState:', audio.readyState);
      console.log('Audio src:', audio.src);
      console.log('Audio networkState:', audio.networkState);
      
      if (audio.readyState < 2) {
        console.log('Audio not ready, readyState:', audio.readyState);
        // Try to force load more data
        audio.load();
        // Wait a bit and try again
        setTimeout(() => {
          console.log('After load(), readyState:', audio.readyState);
          if (audio.readyState >= 2) {
            audio.play().then(() => setIsPlaying(true)).catch(console.error);
          } else {
            console.log('Audio not ready, readyState:', audio.readyState);
          }
        }, 1000);
        return;
      }
      
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (e) {
        console.error('Audio play failed:', e);
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    // Don't seek if we're currently dragging
    if (isDraggingProgress) {
      console.log('🎛️ WAVEFORM PLAYER: Ignoring seek during drag');
      return;
    }
    
    const audio = audioRef.current;
    if (!audio || duration === 0) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const newTime = ratio * duration;
    
    console.log('🎛️ WAVEFORM PLAYER: Seeking', {
      from: audio.currentTime,
      to: newTime,
      duration: duration,
      ratio
    });
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log('🎛️ WAVEFORM PLAYER: Mouse down on progress bar', {
      clientX: e.clientX,
      isDraggingProgress
    });
    setIsDraggingProgress(true);
    handleSeek(e);
    // Prevent click event from firing after drag to avoid double-seeking
    e.preventDefault();
  };

  const handleProgressMouseMove = (e: MouseEvent) => {
    if (!isDraggingProgress) return;
    
    const audio = audioRef.current;
    if (!audio || duration === 0) return;
    
    // Find the progress bar element
    const progressBar = document.querySelector('.waveform-progress-bar-container') as HTMLDivElement;
    if (!progressBar) return;
    
    const rect = progressBar.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const newTime = ratio * duration;
    
    console.log('🎛️ WAVEFORM PLAYER: Dragging progress', {
      from: audio.currentTime,
      to: newTime,
      ratio,
      clientX: e.clientX,
      rectLeft: rect.left,
      rectWidth: rect.width
    });
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleProgressMouseUp = () => {
    console.log('🎛️ WAVEFORM PLAYER: Mouse up on progress bar', {
      isDraggingProgress
    });
    setIsDraggingProgress(false);
  };

  // Global mouse event listeners for dragging
  useEffect(() => {
    if (isDraggingProgress) {
      document.addEventListener('mousemove', handleProgressMouseMove);
      document.addEventListener('mouseup', handleProgressMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleProgressMouseMove);
        document.removeEventListener('mouseup', handleProgressMouseUp);
      };
    }
  }, [isDraggingProgress]);

  const handleVolume = (value: number) => {
    const clamped = Math.min(Math.max(value, 0), 1);
    setVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    // Unmute when volume is changed (if it's not 0)
    if (isMuted && clamped > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isMuted) {
      // Unmute - restore previous volume
      audio.volume = volume;
      setIsMuted(false);
    } else {
      // Mute - save current volume and set to 0
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || time < 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Simple placeholder - NO CANVAS FOR DEBUGGING */}
      <div className="bg-gray-100 rounded p-4 text-center text-gray-500">
        <p>Bare Audio Player - Exact Copy of Preview Player</p>
        <p className="text-sm">All complex logic stripped out, identical to preview player</p>
      </div>
      
      {/* Custom Player Controls - EXACT COPY FROM PREVIEW PLAYER */}
      <div className="flex items-center justify-between gap-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
        <button
          onClick={togglePlayPause}
          className="transition-colors duration-300 text-gray-600 hover:text-gray-800 focus:outline-none"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        
        <div className="flex-1 mx-6">
          <div 
            className="rounded-full h-2 bg-gray-200 cursor-pointer relative waveform-progress-bar-container" 
            onClick={handleSeek}
            onMouseDown={handleProgressMouseDown}
          >
            <div 
              className="bg-gray-800 h-2 rounded-full transition-all duration-300 relative"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            >
              {/* Slide switch handle */}
              <div 
                className="absolute right-0 top-1/2 w-4 h-4 bg-gray-100 rounded-full shadow-sm border border-gray-300"
                style={{ 
                  right: '-8px',
                  transform: 'translateY(-50%)'
                }}
              />
            </div>
          </div>
        </div>
        
        <span className="text-gray-600 text-sm min-w-[80px] text-right">
          {formatTime(currentTime)} / {isFinite(duration) && duration > 0 ? formatTime(duration) : 'Loading...'}
        </span>

        {/* Volume */}
        <div className="flex items-center gap-2 w-40">
          <button 
            onClick={toggleMute}
            className="transition-colors hover:opacity-80 focus:outline-none"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            <svg className="w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {/* Speaker base */}
              <path d="M5 9v6h4l5 4V5L9 9H5z"/>
              {/* Curvy volume level waves - only show when not muted and volume > 0 */}
              {!isMuted && volume > 0 && (
                <path 
                  d="M16 10c0-1.1.9-2 2-2s2 .9 2 2v4c0 1.1-.9 2-2 2s-2-.9-2-2v-4z" 
                  className="opacity-60"
                />
              )}
              {!isMuted && volume > 0.3 && (
                <path 
                  d="M17 8c0-1.1.9-2 2-2s2 .9 2 2v8c0 1.1-.9 2-2 2s-2-.9-2-2V8z" 
                  className="opacity-70"
                />
              )}
              {!isMuted && volume > 0.6 && (
                <path 
                  d="M18 6c0-1.1.9-2 2-2s2 .9 2 2v12c0 1.1-.9 2-2 2s-2-.9-2-2V6z" 
                  className="opacity-80"
                />
              )}
              {!isMuted && volume > 0.8 && (
                <path 
                  d="M19 4c0-1.1.9-2 2-2s2 .9 2 2v16c0 1.1-.9 2-2 2s-2-.9-2-2V4z" 
                  className="opacity-90"
                />
              )}
            </svg>
          </button>
          <div 
            className="w-full h-2 rounded-full bg-gray-200 cursor-pointer relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const percentage = clickX / rect.width;
              handleVolume(percentage);
            }}
          >
            <div 
              className="h-2 bg-gray-800 rounded-full"
              style={{ width: `${isMuted ? 0 : volume * 100}%` }}
            />
          </div>
        </div>
      </div>
      
      <audio 
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        crossOrigin="anonymous"
        className="hidden"
        id="waveform-player-audio"
      />
    </div>
  );
};

export default Waveform;