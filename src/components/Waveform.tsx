import React, { useEffect, useRef, useState } from 'react';
import Peaks from 'peaks.js';
import { Loader2 } from 'lucide-react';

type Props = {
  audioUrl: string;
};

const Waveform: React.FC<Props> = ({ audioUrl }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const overviewContainerRef = useRef<HTMLDivElement | null>(null);
  const zoomviewContainerRef = useRef<HTMLDivElement | null>(null);
  const [isPeaksReady, setIsPeaksReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl]);

  // Player functions
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const newTime = ratio * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolume = (value: number) => {
    const clamped = Math.min(Math.max(value, 0), 1);
    setVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Проверяем готовность DOM элементов
  useEffect(() => {
    if (audioRef.current && overviewContainerRef.current && zoomviewContainerRef.current) {
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
    console.log('Zoomview container:', zoomviewContainerRef.current);

    const options = {
      zoomview: {
        container: zoomviewContainerRef.current!
      },
      overview: {
        container: overviewContainerRef.current!
      },
      mediaElement: audioRef.current!,
      webAudio: {
        audioContext: new (window.AudioContext || (window as any).webkitAudioContext)(),
      },
    };

    Peaks.init(options, (err, peaks) => {
      if (err) {
        console.error('Peaks init error:', err);
        return;
      }

      console.log('Peaks.js initialized successfully!');
      
      // Добавляем кастомный курсор (пример)
      peaks.views.getView('overview').enableSeek(true);

      // Можно подписаться на события (например, перемещение курсора)
      peaks.on('player.seeked', (time: number) => {
        console.log('Cursor moved to', time);
      });
    });

    return () => {
      // cleanup при размонтировании
      // Peaks.js автоматически очищается при размонтировании компонента
    };
  }, [isPeaksReady, audioUrl]);

  return (
    <div className="space-y-4">
      {/* Zoomview */}
      <div className="bg-gray-700 rounded p-2">
        <div ref={zoomviewContainerRef} style={{ width: '100%', height: '100px' }} />
      </div>
      
      {/* Overview */}
      <div className="bg-gray-700 rounded p-2">
        <div ref={overviewContainerRef} style={{ width: '100%', height: '150px' }} />
      </div>
      
      {/* Custom Player Controls */}
      <div className="flex items-center justify-between gap-4 bg-gray-800 rounded-lg p-4">
        <button
          onClick={togglePlayPause}
          className="rounded-full p-4 transition-colors duration-300 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
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
            className="rounded-full h-2 bg-gray-600 cursor-pointer" 
            onClick={handleSeek}
          >
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>
        
        <span className="text-gray-300 text-sm min-w-[80px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Volume */}
        <div className="flex items-center gap-2 w-40">
          <svg className="w-5 h-5 text-gray-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {/* Speaker base */}
            <path d="M5 9v6h4l5 4V5L9 9H5z"/>
            {/* Curvy volume level waves */}
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
      
      {/* Hidden audio element */}
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        className="hidden" 
        preload="auto"
        crossOrigin="anonymous"
      />
    </div>
  );
};

export default Waveform;
