import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Scissors } from 'lucide-react';

// Import our custom hooks and components
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useWaveform } from '@/hooks/useWaveform';
import { useSoundCloudWaveform } from '@/hooks/useSoundCloudWaveform';
import { WaveformContainer } from '@/components/WaveformContainer';
import { SoundCloudWaveform } from '@/components/SoundCloudWaveform';
import { AudioControls } from '@/components/AudioControls';
import { TimeDisplay } from '@/components/TimeDisplay';
import { formatTime, formatTimeForFilename } from '@/utils/timeUtils';
import { generateAudioFilename } from '@/utils/fileUtils';
import { SoundCloudService } from '@/services';

interface ManualSplitEditorProps {
  audioUrl: string;
  duration: number;
  onExport: (startTime: number, endTime: number, format: string) => void;
}

export const ManualSplitEditorRefactored: React.FC<ManualSplitEditorProps> = ({
  audioUrl,
  duration,
  onExport
}) => {
  // State for manual splitting
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(duration);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<'start' | 'end' | null>(null);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [virtualPlaybackTime, setVirtualPlaybackTime] = useState(0);
  const [wasPlayingBeforeDrag, setWasPlayingBeforeDrag] = useState(false);

  // Canvas ref for waveform drawing
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use our custom hooks
  const {
    audioRef,
    isPlaying,
    currentTime,
    isLoading: audioLoading,
    play,
    pause,
    stop,
    seek
  } = useAudioPlayer({
    audioUrl: audioUrl ? `http://localhost:3001/stream?url=${encodeURIComponent(audioUrl)}` : undefined,
    onTimeUpdate: (time) => {
      if (!isDragging) {
        setCurrentTime(time);
      }
    },
    onEnded: () => {
      setIsPlaying(false);
    }
  });

  // Check if it's a SoundCloud URL
  const isSoundCloud = audioUrl ? SoundCloudService.isSoundCloudUrl(audioUrl) : false;

  // Use SoundCloud waveform for SoundCloud URLs
  const {
    waveformData: soundCloudWaveform,
    isLoading: soundCloudLoading,
    error: soundCloudError
  } = useSoundCloudWaveform({
    audioUrl: isSoundCloud ? audioUrl : undefined,
    onWaveformReady: (data) => {
      console.log('✅ SoundCloud waveform ready!', data.length, 'points');
    },
    onError: (error) => {
      console.error('❌ SoundCloud waveform error:', error);
    }
  });

  // Use regular Wavesurfer for non-SoundCloud URLs
  const {
    waveformRef,
    isLoading: waveformLoading,
    isReady: waveformReady
  } = useWaveform({
    audioUrl: !isSoundCloud && audioUrl ? `http://localhost:3001/stream?url=${encodeURIComponent(audioUrl)}` : undefined,
    containerId: 'waveform-container',
    onReady: () => {
      console.log('✅ Waveform ready!');
    },
    onError: (error) => {
      console.error('❌ Waveform error:', error);
    },
    onTimeUpdate: (time) => {
      if (!isDragging) {
        setCurrentTime(time);
      }
    }
  });

  // Handle dragging logic
  const handleMouseDown = (e: React.MouseEvent, handle: 'start' | 'end') => {
    e.preventDefault();
    setIsDragging(true);
    setDragHandle(handle);
    setWasPlayingBeforeDrag(isPlaying);
    
    if (isPlaying) {
      pause();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / canvas.width) * duration;
    
    const clampedTime = Math.max(0, Math.min(duration, time));
    
    if (dragHandle === 'start') {
      setStartTime(Math.min(clampedTime, endTime - 0.1));
    } else if (dragHandle === 'end') {
      setEndTime(Math.max(clampedTime, startTime + 0.1));
    }
    
    setVirtualPlaybackTime(clampedTime);
    setMousePosition({ x: e.clientX, y: e.clientY });
    setHoverTime(clampedTime);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragHandle(null);
      setMousePosition(null);
      setHoverTime(null);
      
      if (wasPlayingBeforeDrag) {
        play();
      }
    }
  };

  // Handle canvas click for seeking
  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!canvasRef.current || isDragging) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / canvas.width) * duration;
    
    seek(time);
  };

  // Export functions
  const handleExport = (format: string) => {
    onExport(startTime, endTime, format);
  };

  const isLoading = audioLoading || (isSoundCloud ? soundCloudLoading : waveformLoading);
  const waveformReady = isSoundCloud ? !!soundCloudWaveform : waveformReady;

  return (
    <div className="w-full space-y-6">
      {/* Hidden audio element */}
      <audio 
        ref={audioRef}
        preload="metadata"
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Waveform Display */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white mb-2">Manual Split Editor</h3>
          <p className="text-gray-300 text-sm">
            Drag the handles to select the audio segment you want to export.
          </p>
        </div>

        {/* Waveform Container */}
        <div className="relative">
          {isSoundCloud && soundCloudWaveform ? (
            <SoundCloudWaveform
              waveformData={soundCloudWaveform}
              duration={duration}
              currentTime={isDragging ? virtualPlaybackTime : currentTime}
              startTime={startTime}
              endTime={endTime}
              onTimeClick={(time) => seek(time)}
            />
          ) : (
            <WaveformContainer 
              isLoading={isLoading}
              containerId="waveform-container"
            />
          )}
          
          {/* Time Tooltip */}
          {mousePosition && hoverTime !== null && (
            <div 
              className="absolute pointer-events-none bg-gray-900 text-white text-xs px-2 py-1 rounded shadow-lg z-10"
              style={{
                left: mousePosition.x - 25,
                top: mousePosition.y - 35,
              }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Audio Controls */}
        <div className="mt-4 flex items-center justify-between">
          <AudioControls
            isPlaying={isPlaying}
            isLoading={isLoading}
            onPlay={play}
            onPause={pause}
            onStop={stop}
            disabled={!waveformReady}
          />
          
          <TimeDisplay
            currentTime={isDragging ? virtualPlaybackTime : currentTime}
            duration={duration}
          />
        </div>

        {/* Time Selection */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Start Time
            </label>
            <Input
              type="text"
              value={formatTime(startTime)}
              onChange={(e) => {
                const time = parseTime(e.target.value);
                if (!isNaN(time) && time >= 0 && time < endTime) {
                  setStartTime(time);
                }
              }}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              End Time
            </label>
            <Input
              type="text"
              value={formatTime(endTime)}
              onChange={(e) => {
                const time = parseTime(e.target.value);
                if (!isNaN(time) && time > startTime && time <= duration) {
                  setEndTime(time);
                }
              }}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
        </div>

        {/* Export Controls */}
        <div className="mt-6 flex items-center gap-4">
          <Button
            onClick={() => handleExport('mp3')}
            disabled={isLoading || !waveformReady}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export MP3
          </Button>
          
          <Button
            onClick={() => handleExport('wav')}
            disabled={isLoading || !waveformReady}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Scissors className="h-4 w-4" />
            Export WAV
          </Button>
        </div>

        {/* Selection Info */}
        <div className="mt-4 p-3 bg-gray-700 rounded-lg">
          <div className="text-sm text-gray-300">
            <div className="flex justify-between">
              <span>Selection:</span>
              <span>{formatTime(endTime - startTime)}</span>
            </div>
            <div className="flex justify-between">
              <span>Range:</span>
              <span>{formatTime(startTime)} - {formatTime(endTime)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to parse time (should be imported from utils)
const parseTime = (timeString: string): number => {
  const parts = timeString.split(':').map(Number);
  
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return 0;
};

export default ManualSplitEditorRefactored;
