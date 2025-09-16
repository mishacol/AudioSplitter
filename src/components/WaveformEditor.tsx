import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';

interface WaveformEditorProps {
  audioBlobUrl: string;
  onSplitPointAdd: (time: number) => void;
  onSplitPointRemove: (index: number) => void;
  splitPoints: number[];
  onSeek: (time: number) => void;
  onPlayPause: () => void;
  duration: number;
}

const WaveformEditor: React.FC<WaveformEditorProps> = ({
  audioBlobUrl,
  onSplitPointAdd,
  onSplitPointRemove,
  splitPoints,
  onSeek,
  onPlayPause,
  duration,
}) => {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<any[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!waveformRef.current || !audioBlobUrl) return;

    // Initialize WaveSurfer
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4F46E5',
      progressColor: '#7C3AED',
      cursorColor: '#F59E0B',
      barWidth: 2,
      barRadius: 3,
      height: 120,
      normalize: true,
      backend: 'WebAudio',
      mediaControls: false,
    });

    // Add regions plugin for split points
    const regions = wavesurfer.registerPlugin(RegionsPlugin.create());

    wavesurferRef.current = wavesurfer;

    // Load audio
    wavesurfer.load(audioBlobUrl);

    // Event listeners
    wavesurfer.on('ready', () => {
      setIsReady(true);
      console.log('Waveform ready');
    });

    wavesurfer.on('audioprocess', (time: number) => {
      onSeek(time);
    });

    wavesurfer.on('interaction', (time: number) => {
      onSeek(time);
    });

    wavesurfer.on('play', () => {
      onPlayPause();
    });

    wavesurfer.on('pause', () => {
      onPlayPause();
    });

    // Handle click to add split point
    wavesurfer.on('click', (relativeX: number) => {
      const clickTime = relativeX * duration;
      onSplitPointAdd(clickTime);
    });

    return () => {
      wavesurfer.destroy();
      setIsReady(false);
    };
  }, [audioBlobUrl, duration]);

  // Update regions when split points change
  useEffect(() => {
    if (!wavesurferRef.current || !isReady) return;

    const wavesurfer = wavesurferRef.current;
    const regions = wavesurfer.getActivePlugins()[0] as any; // Regions plugin

    // Clear existing regions
    regionsRef.current.forEach(region => region.remove());
    regionsRef.current = [];

    // Add new regions for split points
    splitPoints.forEach((point, index) => {
      const region = regions.addRegion({
        start: point,
        end: point + 0.1, // Small region to show the split point
        color: 'rgba(239, 68, 68, 0.3)',
        drag: true,
        resize: false,
      });

      // Add region label
      const label = document.createElement('div');
      label.textContent = `${index + 1}`;
      label.style.cssText = `
        position: absolute;
        top: -20px;
        left: 50%;
        transform: translateX(-50%);
        background: #EF4444;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: bold;
        pointer-events: none;
        z-index: 10;
      `;
      
      region.element.appendChild(label);

      // Handle region drag
      region.on('update-end', () => {
        const newTime = region.start;
        onSplitPointRemove(index);
        onSplitPointAdd(newTime);
      });

      // Handle region click to remove
      region.on('click', () => {
        onSplitPointRemove(index);
      });

      regionsRef.current.push(region);
    });
  }, [splitPoints, isReady]);

  const togglePlayPause = () => {
    if (!wavesurferRef.current) return;
    
    if (wavesurferRef.current.isPlaying()) {
      wavesurferRef.current.pause();
    } else {
      wavesurferRef.current.play();
    }
  };

  const seekTo = (time: number) => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.seekTo(time / duration);
  };

  return (
    <div className="w-full">
      <div ref={waveformRef} className="w-full mb-4" />
      
      {/* Waveform Controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={togglePlayPause}
          className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-3 transition-colors duration-300"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>
        
        <div className="flex items-center gap-2">
          <span className="text-gray-300 text-sm">Click waveform to add split points</span>
        </div>
      </div>
      
      {!isReady && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
            Loading waveform...
          </div>
        </div>
      )}
    </div>
  );
};

export default WaveformEditor;
