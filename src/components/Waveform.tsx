import React, { useEffect, useRef, useState } from 'react';
import Peaks from 'peaks.js';

type Props = {
  audioUrl: string;
  lowResPeaks?: any;
  useCustomPlayer?: boolean;
  audioRef?: React.RefObject<HTMLAudioElement>;
  duration?: number;
  onWaveformReady?: () => void;
};

const Waveform: React.FC<Props> = ({ audioUrl, lowResPeaks, useCustomPlayer = true, audioRef: externalAudioRef, duration: externalDuration, onWaveformReady }) => {
  const internalAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = externalAudioRef || internalAudioRef;
  const overviewContainerRef = useRef<HTMLDivElement | null>(null);
  const [isPeaksReady, setIsPeaksReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(externalDuration || 0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Update duration when external duration changes
  useEffect(() => {
    if (externalDuration && externalDuration > 0) {
      setDuration(externalDuration);
      setIsLoading(false);
      console.log('External duration set:', externalDuration);
    }
  }, [externalDuration]);

  // Use external duration if available, otherwise use internal
  const displayDuration = externalDuration && externalDuration > 0 ? externalDuration : duration;

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      console.log('No audio element found');
      return;
    }

    console.log('Setting up audio event listeners for:', audio.src);

    const handleLoadedMetadata = () => {
      console.log('Audio metadata loaded, duration:', audio.duration);
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      console.log('Audio can play, duration:', audio.duration);
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleLoadStart = () => {
      console.log('Audio load started');
      setIsLoading(true);
    };

    const handleError = (e: Event) => {
      console.error('Audio error:', e);
      setIsLoading(false);
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    // If audio is already loaded, set duration immediately
    if (audio.duration && audio.duration > 0) {
      console.log('Audio already loaded, duration:', audio.duration);
      setDuration(audio.duration);
      setIsLoading(false);
    }

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl, audioRef.current]);

  // Проверяем готовность DOM элементов
  useEffect(() => {
    if (audioRef.current && overviewContainerRef.current) {
      setIsPeaksReady(true);
    } else {
      setIsPeaksReady(false);
    }
  }, [audioUrl]);

  // Инициализируем Peaks.js только когда все готово
  useEffect(() => {
    if (!isPeaksReady) {
      console.log('Peaks.js refs not yet ready.');
      return;
    }

    console.log('Initializing Peaks.js...');
    console.log('Audio element:', audioRef.current);
    console.log('Overview container:', overviewContainerRef.current);
    console.log('Audio duration:', audioRef.current?.duration);
    console.log('Audio readyState:', audioRef.current?.readyState);
    console.log('Container dimensions:', {
      width: overviewContainerRef.current?.offsetWidth,
      height: overviewContainerRef.current?.offsetHeight
    });

    // Ensure container has proper dimensions
    if (overviewContainerRef.current) {
      overviewContainerRef.current.style.width = '100%';
      overviewContainerRef.current.style.height = '200px';
      overviewContainerRef.current.style.minHeight = '200px';
    }

    // Wait for audio to be ready
    const initPeaks = () => {
      if (!audioRef.current || audioRef.current.readyState < 2) {
        console.log('Audio not ready yet, waiting...');
        setTimeout(initPeaks, 100);
        return;
      }

      console.log('Audio is ready, initializing Peaks.js...');
      const options = {
      overview: {
        container: overviewContainerRef.current!,
        waveformColor: 'rgba(194, 173, 172, 0.21)',
        playedWaveformColor: '#3b82f6',
        axisGridlineColor: 'white',
        axisLabelColor: 'white'
      },
      mediaElement: audioRef.current!,
      webAudio: {
        audioContext: new (window.AudioContext || (window as any).webkitAudioContext)(),
      },
      // Enable regions at top level
      regions: true,
      // Playhead-related colors
      playheadColor: '#fff',
      cursorColor: "#fff",
      pointMarkerColor: 'rgba(234, 41, 31, 0.21)'
    };

    Peaks.init(options, (err, peaks) => {
      if (err) {
        console.error('Peaks init error:', err);
        return;
      }

      console.log('Peaks.js initialized successfully!');
      console.log('Peaks instance:', peaks);
      console.log('Available methods:', Object.keys(peaks));
      console.log('Regions object:', (peaks as any).regions);
      
      // Notify parent that waveform is ready
      onWaveformReady?.();
      
      // Enable seeking on overview
      peaks.views.getView('overview').enableSeek(true);

      // Enable region creation by dragging
      (peaks.views.getView('overview') as any).enableRegionCreation(true);
      
      // Wait a bit for the waveform to load, then add test region
      setTimeout(() => {
        try {
          // Try to add a test region to see if regions work at all
          (peaks as any).regions.add({
            startTime: 10,
            endTime: 20,
            color: 'yellow',
            labelText: 'Test Region'
          });
          
          console.log('Test region added successfully');
        } catch (error) {
          console.error('Failed to add test region:', error);
        }
      }, 1000);
      
      console.log('Peaks regions enabled, will add test region in 1 second');

      // Listen for region events
      (peaks as any).on('regions.add', (region: any) => {
        console.log('Region added:', region);
      });

      (peaks as any).on('regions.remove', (region: any) => {
        console.log('Region removed:', region);
      });

      (peaks as any).on('regions.update', (region: any) => {
        console.log('Region updated:', region);
      });

      // Listen for player events
      peaks.on('player.seeked', (time: number) => {
        console.log('Cursor moved to', time);
      });
    });
    };

    // Start the initialization process
    initPeaks();

    return () => {
      // cleanup при размонтировании
      // Peaks.js автоматически очищается при размонтировании компонента
    };
  }, [isPeaksReady, audioUrl]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => setVolume(audio.volume);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('volumechange', handleVolumeChange);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('volumechange', handleVolumeChange);
    };
  }, []);

  // Player functions
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !displayDuration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width)); // Clamp between 0 and 1
    const newTime = percentage * displayDuration;
    
    // Store current playing state
    const wasPlaying = !audio.paused;
    
    // Seek to new position
    audio.currentTime = newTime;
    setCurrentTime(newTime);
    
    // Resume playing if it was playing before
    if (wasPlaying && audio.paused) {
      audio.play().catch(console.error);
    }
  };

  const handleVolume = (newVolume: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.volume = newVolume;
    setVolume(newVolume);
  };

  const formatTime = (time: number): string => {
    if (!time || !isFinite(time)) return '0:00';
    
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2">
      {/* Add CSS for Peaks.js regions */}
      <style>{`
        .peaks-region {
          border: 2px solid yellow !important;
          background-color: rgba(255, 255, 0, 0.2) !important;
        }
        .peaks-region-label {
          color: yellow !important;
          background-color: rgba(0, 0, 0, 0.8) !important;
        }
      `}</style>
      
      {/* Loading indicator */}
      {(isLoading || displayDuration === 0) && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-gray-300 text-sm">
            {displayDuration === 0 ? 'Loading audio...' : 'Loading waveform...'}
          </span>
        </div>
      )}
      
      {/* Overview */}
      <div ref={overviewContainerRef} style={{ width: '100%', height: '150px' }} />
      
      {/* Custom Player Controls - only show when waveform is ready */}
      {useCustomPlayer && displayDuration > 0 ? (
        <div className="flex items-center gap-3 bg-gray-800 rounded p-3">
          <button
            onClick={togglePlayPause}
            className="rounded-full p-3 transition-colors duration-300 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>
          
          <div className="flex-1 mx-4">
            <div 
              className="rounded-full h-2 bg-gray-600 cursor-pointer" 
              onClick={handleSeek}
            >
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${displayDuration ? (currentTime / displayDuration) * 100 : 0}%` }}
              />
            </div>
          </div>
          
          <span className="text-gray-300 text-sm min-w-[70px] text-right">
            {formatTime(currentTime)} / {formatTime(displayDuration)}
          </span>

          {/* Volume */}
          <div className="flex items-center gap-2 w-32">
            <svg className="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M5 9v6h4l5 4V5L9 9H5z"/>
              {volume > 0 && (
                <path 
                  d="M16 10c0-1.1.9-2 2-2s2 .9 2 2v4c0 1.1-.9 2-2 2s-2-.9-2-2v-4z" 
                  className="opacity-60"
                />
              )}
              {volume > 0.3 && (
                <path 
                  d="M17 8c0-1.1.9-2 2-2s2 .9 2 2v8c0 1.1-.9 2-2 2s-2-.9-2-2V8z" 
                  className="opacity-70"
                />
              )}
              {volume > 0.6 && (
                <path 
                  d="M18 6c0-1.1.9-2 2-2s2 .9 2 2v12c0 1.1-.9 2-2 2s-2-.9-2-2V6z" 
                  className="opacity-80"
                />
              )}
              {volume > 0.8 && (
                <path 
                  d="M19 4c0-1.1.9-2 2-2s2 .9 2 2v16c0 1.1-.9 2-2 2s-2-.9-2-2V4z" 
                  className="opacity-90"
                />
              )}
            </svg>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => handleVolume(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
              aria-label="Volume"
            />
          </div>
        </div>
      ) : (
        <audio ref={audioRef} src={audioUrl} controls className="w-full" />
      )}
      
      {/* Hidden audio element - only when using internal audioRef */}
      {!externalAudioRef && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          className="hidden" 
          preload="auto"
          crossOrigin="anonymous"
        />
      )}
    </div>
  );
};

export default Waveform;
