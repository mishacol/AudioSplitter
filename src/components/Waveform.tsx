import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { peaksService, type PeaksJson } from '@/services/peaksService';

type Props = {
  audioUrl: string;
  selection?: { start: number | null; end: number | null };
  onSelectionChange?: (start: number | null, end: number | null) => void;
  onWaveformReady?: () => void;
  expectedDuration?: number; // fallback duration (e.g., from metadata)
};

const Waveform: React.FC<Props> = ({ audioUrl, selection, onSelectionChange, onWaveformReady, expectedDuration }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [jobId, setJobId] = useState<string | null>(null);
  const [low, setLow] = useState<PeaksJson | null>(null);
  const [high, setHigh] = useState<PeaksJson | null>(null);
  const [displayPeaks, setDisplayPeaks] = useState<number[] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const initialClickTimeRef = useRef<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomCenter, setZoomCenter] = useState<number | null>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  // Sync selection prop to internal state
  useEffect(() => {
    if (selection) {
      setSelectionStart(selection.start);
      setSelectionEnd(selection.end);
    }
  }, [selection]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      // Reset playhead to beginning when track ends
      audio.currentTime = 0;
      setCurrentTime(0);
    };

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
      // If playhead is at the end, reset to beginning before playing
      if (audio.currentTime >= audio.duration - 0.1) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }
      audio.play().catch(console.error);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const total = effectiveDuration || audio?.duration || 0;
    if (!audio || total === 0) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const newTime = ratio * total;
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
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const durationFromPeaks = (p?: PeaksJson | null) => {
    if (!p) return 0;
    if (p.duration && p.duration > 0) return p.duration;
    if (p.points && (p as any).window_samples && p.sample_rate) {
      const windowSamples = (p as any).window_samples as number;
      const est = (p.points * windowSamples) / p.sample_rate;
      return Number.isFinite(est) && est > 0 ? est : 0;
    }
    return 0;
  };

  const effectiveDuration = (() => {
    // If we have high-res peaks, use their duration (this is the actual processed audio length)
    const highDur = durationFromPeaks(high);
    if (highDur > 0) return highDur;
    
    // Check if audio duration is valid (not 0, not Infinity, not NaN)
    if (duration && Number.isFinite(duration) && duration > 0) {
      return duration;
    }
    // Prioritize expected duration over placeholder peaks
    if (expectedDuration && Number.isFinite(expectedDuration) && expectedDuration > 0) {
      return expectedDuration;
    }
    // Fall back to low-res peaks duration (only if not placeholder)
    const lowDur = durationFromPeaks(low);
    if (lowDur > 0 && lowDur > 1) return lowDur; // Ignore placeholder durations < 1 second
    return 0;
  })();

  // Debug logging
  console.log('Duration debug:', {
    audioDuration: duration,
    highDuration: durationFromPeaks(high),
    lowDuration: durationFromPeaks(low),
    expectedDuration,
    effectiveDuration,
    high: high ? { points: high.points, duration: high.duration } : null,
    low: low ? { points: low.points, duration: low.duration } : null
  });

  // Canvas waveform renderer (peaks + playhead + selection)
  useEffect(() => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fit to device pixel ratio
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const cssHeight = 150;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const drawPeaks = () => {
      if (!displayPeaks || displayPeaks.length === 0) return;
      const width = rect.width;
      const height = cssHeight;
      const midY = height / 2;
      const pixels = Math.max(1, Math.floor(width));
      
      // Professional purple waveform like in the screenshot
      ctx.fillStyle = '#8B5CF6'; // Purple color
      ctx.strokeStyle = '#8B5CF6';
      ctx.lineWidth = 1;
      
      // Calculate zoom parameters
      const centerTime = zoomCenter || effectiveDuration / 2;
      const visibleDuration = effectiveDuration / zoomLevel;
      const startTime = Math.max(0, centerTime - visibleDuration / 2);
      const endTime = Math.min(effectiveDuration, centerTime + visibleDuration / 2);
      
      // Draw waveform as vertical bars (like professional audio editors)
      for (let x = 0; x < pixels; x++) {
        // Map screen pixel to time
        const screenTime = startTime + (x / pixels) * (endTime - startTime);
        
        // Map time to peaks array index
        const peakIndex = Math.floor((screenTime / effectiveDuration) * displayPeaks.length);
        
        if (peakIndex >= 0 && peakIndex < displayPeaks.length) {
          const v = Math.abs(displayPeaks[peakIndex] || 0);
          
          // Draw vertical bar from center line
          const barHeight = Math.max(1, v * (height - 20) / 2);
          ctx.fillRect(x, midY - barHeight, 1, barHeight * 2);
        }
      }
    };

    let raf = 0;
    const render = () => {
      const w = rect.width;
      const h = cssHeight;
      
      // White background like in screenshot
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      
      // waveform
      drawPeaks();

      // selection overlay (blue like in screenshot)
      if (selectionStart != null && selectionEnd != null && effectiveDuration > 0) {
        // Calculate zoom parameters for selection rendering
        const centerTime = zoomCenter || effectiveDuration / 2;
        const visibleDuration = effectiveDuration / zoomLevel;
        const startTime = Math.max(0, centerTime - visibleDuration / 2);
        const endTime = Math.min(effectiveDuration, centerTime + visibleDuration / 2);
        
        // Map selection times to screen coordinates
        const sx = ((selectionStart - startTime) / (endTime - startTime)) * w;
        const ex = ((selectionEnd - startTime) / (endTime - startTime)) * w;
        const left = Math.min(sx, ex);
        const right = Math.max(sx, ex);
        
        // Only draw selection if it's visible in current zoom window
        if (right >= 0 && left <= w) {
          // Blue selection overlay
          ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // Blue overlay
          ctx.fillRect(left, 0, right - left, h);
          
          // Grey boundary markers
          ctx.fillStyle = '#6B7280'; // Grey color
          ctx.fillRect(left - 1, 0, 2, h);
          ctx.fillRect(right - 1, 0, 2, h);
        }
      }

      // playhead (red like in screenshot)
      if (effectiveDuration > 0) {
        const centerTime = zoomCenter || effectiveDuration / 2;
        const visibleDuration = effectiveDuration / zoomLevel;
        const startTime = Math.max(0, centerTime - visibleDuration / 2);
        const endTime = Math.min(effectiveDuration, centerTime + visibleDuration / 2);
        
        const x = ((currentTime - startTime) / (endTime - startTime)) * w;
        
        // Only draw playhead if it's visible in current zoom window
        if (x >= 0 && x <= w) {
          ctx.fillStyle = '#EF4444'; // Red playhead
          ctx.fillRect(Math.max(0, Math.min(w - 2, x)), 0, 2, h);
        }
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [currentTime, effectiveDuration, displayPeaks, selectionStart, selectionEnd, zoomLevel, zoomCenter]);

  // Start peaks job when audioUrl changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const job = await peaksService.start(audioUrl);
        if (cancelled) return;
        setJobId(job.job_id);
        const lowData = await peaksService.waitForLow(job.job_id, 5000);
        if (!cancelled) {
          setLow(lowData);
          if (lowData) console.log('Low peaks loaded:', { points: lowData.points, duration: lowData.duration });
        }
        // kick off high-res fetch but don't block UI
        peaksService.waitForHigh(job.job_id).then((h) => {
          if (!cancelled) {
            setHigh(h);
            if (h) console.log('High peaks loaded:', { points: h.points, duration: h.duration });
            // Call onWaveformReady when high-res peaks are loaded
            onWaveformReady?.();
          }
        });
      } catch (e) {
        console.error('peaks job error', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  // Pick peaks to display (prefer high-res when ready)
  useEffect(() => {
    if (high && Array.isArray(high.peaks) && high.peaks.length > 0) {
      setDisplayPeaks(high.peaks);
    } else if (low && Array.isArray(low.peaks) && low.peaks.length > 0) {
      setDisplayPeaks(low.peaks);
    }
  }, [low, high]);

  // Auto-jump playhead to selection start when selection is created
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !selectionStart || !selectionEnd) return;
    
    // Only jump if we have a valid selection and it's not a zero-width selection
    if (selectionStart !== selectionEnd) {
      const startTime = Math.min(selectionStart, selectionEnd);
      audio.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [selectionStart, selectionEnd]);

  // Auto-scroll to follow playhead when zoomed in
  useEffect(() => {
    if (!autoScrollEnabled || !isPlaying || zoomLevel <= 1) return;
    
    const centerTime = zoomCenter || effectiveDuration / 2;
    const visibleDuration = effectiveDuration / zoomLevel;
    const startTime = Math.max(0, centerTime - visibleDuration / 2);
    const endTime = Math.min(effectiveDuration, centerTime + visibleDuration / 2);
    
    // Check if playhead is outside visible range
    if (currentTime < startTime || currentTime > endTime) {
      // Smoothly scroll to center playhead
      setZoomCenter(currentTime);
    }
  }, [currentTime, isPlaying, autoScrollEnabled, zoomLevel, effectiveDuration, zoomCenter]);

  // Zoom to selection when selection is created
  useEffect(() => {
    if (!selectionStart || !selectionEnd || selectionStart === selectionEnd) return;
    
    const selectionDuration = Math.abs(selectionEnd - selectionStart);
    const selectionCenter = (selectionStart + selectionEnd) / 2;
    
    // Calculate zoom level to fit selection with some padding
    const padding = 0.2; // 20% padding on each side
    const targetZoomLevel = effectiveDuration / (selectionDuration * (1 + padding * 2));
    
    // Only zoom if it's a meaningful zoom (not too extreme)
    if (targetZoomLevel > 1 && targetZoomLevel < 16) {
      setZoomLevel(targetZoomLevel);
      setZoomCenter(selectionCenter);
    }
  }, [selectionStart, selectionEnd, effectiveDuration]);

  // Canvas mouse interactions: click-to-seek + drag-select
  useEffect(() => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio) return;

    const getTimeAt = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      
      // Calculate zoom parameters
      const centerTime = zoomCenter || effectiveDuration / 2;
      const visibleDuration = effectiveDuration / zoomLevel;
      const startTime = Math.max(0, centerTime - visibleDuration / 2);
      const endTime = Math.min(effectiveDuration, centerTime + visibleDuration / 2);
      
      return startTime + ratio * (endTime - startTime);
    };

    let dragStartTime = 0;
    let isClick = true;

    const onDown = (e: MouseEvent) => {
      if (e.target !== canvas) return; // ignore clicks outside canvas
      
      dragStartTime = Date.now();
      isClick = true;
      setIsDragging(true);
      
      const t = getTimeAt(e.clientX);
      initialClickTimeRef.current = t;
      setSelectionStart(t);
      setSelectionEnd(t);
      onSelectionChange?.(t, t);
    };

    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      // If mouse moved significantly, it's a drag, not a click
      if (Date.now() - dragStartTime > 100) {
        isClick = false;
      }
      
      const t = getTimeAt(e.clientX);
      
      // Always assign leftmost position to start and rightmost to end
      const start = Math.min(initialClickTimeRef.current || 0, t);
      const end = Math.max(initialClickTimeRef.current || 0, t);
      
      setSelectionStart(start);
      setSelectionEnd(end);
      onSelectionChange?.(start, end);
    };

    const onUp = (e: MouseEvent) => {
      // Always handle mouse up, regardless of dragging state
      setIsDragging(false);
      
      // If it was a click (not a drag), seek to that position
      if (isClick && e.target === canvas) {
        const t = getTimeAt(e.clientX);
        audio.currentTime = t;
        setCurrentTime(t);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Only allow zooming if high-res peaks are loaded
      if (!high || !effectiveDuration || effectiveDuration <= 0) return;
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseTime = getTimeAt(e.clientX);
      
      // Set zoom center to mouse position if not already set
      if (zoomCenter === null) {
        setZoomCenter(mouseTime);
      }
      
      // Calculate zoom change
      const zoomFactor = e.deltaY > 0 ? 0.8 : 1.25; // Zoom out on scroll down, zoom in on scroll up
      const newZoomLevel = Math.max(0.1, Math.min(32, zoomLevel * zoomFactor));
      
      // Update zoom center to mouse position for smooth zooming
      setZoomCenter(mouseTime);
      setZoomLevel(newZoomLevel);
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [effectiveDuration, isDragging, selectionStart, zoomLevel, zoomCenter]);

  return (
    <div className="space-y-4">
      {/* Canvas waveform placeholder */}
      <div className="bg-transparent rounded p-2 select-none">
        <canvas ref={canvasRef} style={{ width: '100%', height: 150 }} />
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
              style={{ width: `${effectiveDuration ? (currentTime / effectiveDuration) * 100 : 0}%` }}
            />
          </div>
        </div>
        
        <span className="text-gray-300 text-sm min-w-[80px] text-right">
          {formatTime(currentTime)} / {formatTime(effectiveDuration)}
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
