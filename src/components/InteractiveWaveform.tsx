import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.esm.js';
import ZoomPlugin from 'wavesurfer.js/dist/plugins/zoom.esm.js';
import { Loader2 } from 'lucide-react';

interface InteractiveWaveformProps {
  audioUrl: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate?: (time: number) => void;
  onRegionCreated?: (startTime: number, endTime: number) => void;
  onRegionRemoved?: (regionId: string) => void;
  className?: string;
}

export interface InteractiveWaveformRef {
  addRegion: (startTime: number, endTime: number, color?: string) => void;
  removeRegion: (regionId: string) => void;
  clearRegions: () => void;
  seekTo: (time: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

const InteractiveWaveform = forwardRef<InteractiveWaveformRef, InteractiveWaveformProps>(({
  audioUrl,
  duration,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onRegionCreated,
  onRegionRemoved,
  className = ''
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<any>(null);
  const timelineRef = useRef<any>(null);
  const zoomRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    addRegion: (startTime: number, endTime: number, color = '#ffeb3b') => {
      if (regionsRef.current) {
        const region = regionsRef.current.addRegion({
          start: startTime,
          end: endTime,
          color: color,
          drag: true,
          resize: true
        });
        return region;
      }
    },
    removeRegion: (regionId: string) => {
      if (regionsRef.current) {
        regionsRef.current.clearRegions();
      }
    },
    clearRegions: () => {
      if (regionsRef.current) {
        regionsRef.current.clearRegions();
      }
    },
    seekTo: (time: number) => {
      if (wavesurferRef.current) {
        wavesurferRef.current.seekTo(time / duration);
      }
    },
    zoomIn: () => {
      if (zoomRef.current) {
        zoomRef.current.zoomIn();
      }
    },
    zoomOut: () => {
      if (zoomRef.current) {
        zoomRef.current.zoomOut();
      }
    },
    resetZoom: () => {
      if (zoomRef.current) {
        zoomRef.current.resetZoom();
      }
    }
  }));

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    const initializeWaveform = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Create plugins
        const regions = RegionsPlugin.create();
        const timeline = TimelinePlugin.create({
          height: 20,
          insertPosition: 'beforebegin',
          timeInterval: 0.2,
          primaryLabelInterval: 5,
          secondaryLabelInterval: 1,
          style: {
            fontSize: '10px',
            color: '#999'
          }
        });
        const zoom = ZoomPlugin.create({
          scale: 1,
          scrollParent: true,
          normalize: true
        });

        regionsRef.current = regions;
        timelineRef.current = timeline;
        zoomRef.current = zoom;

        // Create WaveSurfer instance
        const wavesurfer = WaveSurfer.create({
          container: containerRef.current!,
          waveColor: '#4caf50',
          progressColor: '#2196f3',
          cursorColor: '#ff5722',
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          height: 120,
          normalize: true,
          backend: 'WebAudio',
          plugins: [regions, timeline, zoom]
        });

        wavesurferRef.current = wavesurfer;

        // Load audio
        await wavesurfer.load(audioUrl);

        // Event listeners
        wavesurfer.on('ready', () => {
          setIsLoading(false);
          console.log('🎵 Interactive waveform ready');
        });

        wavesurfer.on('audioprocess', (time: number) => {
          onTimeUpdate?.(time);
        });

        wavesurfer.on('seek', (progress: number) => {
          const time = progress * duration;
          onTimeUpdate?.(time);
        });

        // Region events
        regions.on('region-created', (region: any) => {
          console.log('🎵 Region created:', region.start, region.end);
          onRegionCreated?.(region.start, region.end);
        });

        regions.on('region-updated', (region: any) => {
          console.log('🎵 Region updated:', region.start, region.end);
        });

        regions.on('region-clicked', (region: any, e: Event) => {
          e.stopPropagation();
          // Remove region on click
          region.remove();
          onRegionRemoved?.(region.id);
        });

        // Handle clicks on waveform to add regions
        wavesurfer.on('click', (relativeX: number) => {
          const time = relativeX * duration;
          // Add a small region at click position
          regions.addRegion({
            start: Math.max(0, time - 0.5),
            end: Math.min(duration, time + 0.5),
            color: '#ffeb3b',
            drag: true,
            resize: true
          });
        });

      } catch (err) {
        console.error('❌ Failed to initialize interactive waveform:', err);
        setError('Failed to load interactive waveform');
        setIsLoading(false);
      }
    };

    initializeWaveform();

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [audioUrl, duration, onTimeUpdate, onRegionCreated, onRegionRemoved]);

  // Sync with external playback
  useEffect(() => {
    if (wavesurferRef.current && !isPlaying) {
      const progress = currentTime / duration;
      wavesurferRef.current.seekTo(progress);
    }
  }, [currentTime, duration, isPlaying]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-700 rounded-lg ${className}`}>
        <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
        <p className="ml-2 text-gray-300">Loading interactive waveform...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-red-900/20 border border-red-500 rounded-lg ${className}`}>
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-700 rounded-lg overflow-hidden ${className}`}>
      {/* Zoom Controls */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-600">
        <div className="flex items-center gap-2">
          <button
            onClick={() => zoomRef.current?.zoomOut()}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
          >
            Zoom Out
          </button>
          <button
            onClick={() => zoomRef.current?.zoomIn()}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
          >
            Zoom In
          </button>
          <button
            onClick={() => zoomRef.current?.resetZoom()}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
          >
            Reset
          </button>
        </div>
        <div className="text-gray-400 text-sm">
          Click to add regions • Drag to resize • Click region to remove
        </div>
      </div>

      {/* Waveform Container */}
      <div ref={containerRef} className="w-full" />
    </div>
  );
});

InteractiveWaveform.displayName = 'InteractiveWaveform';

export default InteractiveWaveform;

