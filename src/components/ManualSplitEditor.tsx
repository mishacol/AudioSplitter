import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Play, Pause, Scissors, Square } from 'lucide-react';

interface ManualSplitEditorProps {
  audioUrl: string;
  duration: number;
  onExport: (startTime: number, endTime: number, format: string) => void;
}

const ManualSplitEditor: React.FC<ManualSplitEditorProps> = ({
  audioUrl,
  duration,
  onExport,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(duration);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | 'move' | null>(null);
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [format, setFormat] = useState('mp3');

  // Format time helper
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Generate waveform data - use mock data for instant loading
  useEffect(() => {
    setIsLoading(true);
    
    // Generate realistic audio waveform with peaks, beats, and silence
    const generateMockWaveform = () => {
      const width = 1200;
      const waveform = [];
      
      for (let i = 0; i < width; i++) {
        let amplitude = 0;
        
        // Create different audio sections
        const section = i / width;
        
        if (section < 0.1) {
          // Intro - quiet
          amplitude = Math.random() * 0.1;
        } else if (section < 0.3) {
          // Build up - increasing intensity
          const intensity = (section - 0.1) / 0.2;
          amplitude = Math.random() * intensity * 0.8;
        } else if (section < 0.7) {
          // Main section - strong beats and variations
          const beat = Math.sin(i * 0.1) * 0.4;
          const variation = Math.sin(i * 0.03) * 0.3;
          const noise = (Math.random() - 0.5) * 0.2;
          amplitude = Math.abs(beat + variation + noise);
        } else if (section < 0.9) {
          // Bridge - different pattern
          const bridge = Math.sin(i * 0.05) * 0.6;
          const harmonics = Math.sin(i * 0.15) * 0.2;
          amplitude = Math.abs(bridge + harmonics);
        } else {
          // Outro - fade out
          const fade = (1 - section) / 0.1;
          amplitude = Math.random() * fade * 0.5;
        }
        
        // Add some silence periods
        if (Math.random() < 0.05) {
          amplitude = 0;
        }
        
        // Add sharp peaks
        if (Math.random() < 0.02) {
          amplitude = Math.random() * 0.9 + 0.1;
        }
        
        waveform.push(Math.min(amplitude, 1));
      }
      
      setWaveformData(waveform);
      setIsLoading(false);
    };

    // Simulate loading time
    setTimeout(generateMockWaveform, 500);
  }, [audioUrl]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw waveform as bars (like real audio editors)
    ctx.fillStyle = '#6B7280';
    
    waveformData.forEach((amplitude, index) => {
      const x = (index / waveformData.length) * width;
      const barHeight = amplitude * centerY * 1.6;
      const barWidth = width / waveformData.length;
      
      // Draw vertical bar
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    });

    // Draw selection overlay
    const startX = (selectionStart / duration) * width;
    const endX = (selectionEnd / duration) * width;
    
    // Draw selection background (blue highlight)
    ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.fillRect(startX, 0, endX - startX, height);

    // Draw selection border (yellow outline)
    ctx.strokeStyle = '#FCD34D';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, 0, endX - startX, height);

    // Draw selection handles (yellow borders for start/end points)
    const handleWidth = 12;
    ctx.fillStyle = '#FCD34D';
    ctx.fillRect(startX - 6, 0, handleWidth, height); // Start handle
    ctx.fillRect(endX - 6, 0, handleWidth, height);    // End handle
    
    // Draw handle indicators (black lines for visibility)
    ctx.fillStyle = '#000';
    ctx.fillRect(startX - 1, height/2 - 15, 2, 30); // Start handle indicator
    ctx.fillRect(endX - 1, height/2 - 15, 2, 30);    // End handle indicator

    // Draw playback position
    const playbackX = (currentTime / duration) * width;
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playbackX, 0);
    ctx.lineTo(playbackX, height);
    ctx.stroke();

  }, [waveformData, selectionStart, selectionEnd, currentTime, duration]);

  // Audio controls
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Handle canvas clicks
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return; // Don't seek if we were dragging
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x / canvas.width) * duration;

    // Seek audio
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = clickTime;
      setCurrentTime(clickTime);
    }
  };

  // Handle mouse move for cursor changes
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    
    const startX = (selectionStart / duration) * canvas.width;
    const endX = (selectionEnd / duration) * canvas.width;
    
    const handleWidth = 12; // Wider handles for better UX
    const tolerance = 8;
    
    // Check if mouse is over start handle
    if (x >= startX - tolerance && x <= startX + handleWidth + tolerance) {
      canvas.style.cursor = 'ew-resize';
    } 
    // Check if mouse is over end handle
    else if (x >= endX - tolerance && x <= endX + handleWidth + tolerance) {
      canvas.style.cursor = 'ew-resize';
    } 
    // Check if mouse is over selection region (for moving)
    else if (x > startX + handleWidth && x < endX - handleWidth) {
      canvas.style.cursor = 'move';
    } 
    // Default cursor for seeking
    else {
      canvas.style.cursor = 'pointer';
    }
  };

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickTime = (x / canvas.width) * duration;

    const startX = (selectionStart / duration) * canvas.width;
    const endX = (selectionEnd / duration) * canvas.width;

    const handleWidth = 12; // Match cursor logic
    const tolerance = 8;
    
    // Check for start handle click
    if (x >= startX - tolerance && x <= startX + handleWidth + tolerance) {
      setDragType('start');
      setIsDragging(true);
    } 
    // Check for end handle click
    else if (x >= endX - tolerance && x <= endX + handleWidth + tolerance) {
      setDragType('end');
      setIsDragging(true);
    } 
    // Check for selection region click (move entire selection)
    else if (x > startX + handleWidth && x < endX - handleWidth) {
      setDragType('move');
      setIsDragging(true);
    } 
    // Click outside selection - create new selection
    else {
      setSelectionStart(clickTime);
      setSelectionEnd(Math.min(clickTime + 10, duration));
      setDragType('end');
      setIsDragging(true);
    }
  };


  const handleMouseUp = () => {
    setIsDragging(false);
    setDragType(null);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'pointer';
    }
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || !canvasRef.current) return;

      e.preventDefault();
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clickTime = (x / canvas.width) * duration;

      // Optimize for responsiveness - use requestAnimationFrame for smooth updates
      requestAnimationFrame(() => {
        if (dragType === 'start') {
          const newStart = Math.max(0, Math.min(clickTime, selectionEnd - 0.1));
          setSelectionStart(newStart);
        } else if (dragType === 'end') {
          const newEnd = Math.min(duration, Math.max(clickTime, selectionStart + 0.1));
          setSelectionEnd(newEnd);
        } else if (dragType === 'move') {
          const selectionDuration = selectionEnd - selectionStart;
          const newStart = Math.max(0, Math.min(clickTime, duration - selectionDuration));
          const newEnd = Math.min(duration, newStart + selectionDuration);
          setSelectionStart(newStart);
          setSelectionEnd(newEnd);
        }
      });
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragType(null);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'pointer';
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragType, selectionStart, selectionEnd, duration]);

  // Export functionality
  const handleExport = () => {
    onExport(selectionStart, selectionEnd, format);
    setShowFormatDialog(false);
  };

  return (
    <div className="w-full space-y-6">
      {/* Hidden audio element */}
      <audio 
        ref={audioRef}
        src={`http://localhost:3001/stream?url=${encodeURIComponent(audioUrl)}`}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* Waveform Display */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white text-lg font-semibold">Waveform Editor</h3>
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <span>Start: {formatTime(selectionStart)}</span>
            <span>End: {formatTime(selectionEnd)}</span>
            <span>Duration: {formatTime(selectionEnd - selectionStart)}</span>
          </div>
        </div>

        {/* Waveform Canvas */}
        <div className="relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 bg-gray-700 rounded">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-gray-300">Loading waveform...</p>
              </div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={1200}
              height={120}
              className="w-full h-32 bg-gray-700 rounded"
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          )}
        </div>

        {/* Time markers */}
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i}>{formatTime((duration / 5) * i)}</span>
          ))}
        </div>
      </div>

      {/* Playback Controls */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Button
            onClick={togglePlay}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>
          
          <Button
            onClick={stop}
            variant="outline"
            className="border-gray-600 text-white hover:bg-gray-700"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>

        <div className="text-center text-gray-300 text-sm">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Selection Controls */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white text-lg font-semibold">Selection</h3>
          <div className="flex gap-2">
            <Button
              onClick={() => setSelectionStart(currentTime)}
              variant="outline"
              size="sm"
              className="border-gray-600 text-white hover:bg-gray-700"
            >
              Set Start
            </Button>
            <Button
              onClick={() => setSelectionEnd(currentTime)}
              variant="outline"
              size="sm"
              className="border-gray-600 text-white hover:bg-gray-700"
            >
              Set End
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-gray-300 text-sm mb-1 block">Start Time</label>
            <Input
              type="text"
              value={formatTime(selectionStart)}
              onChange={(e) => {
                // Parse time input if needed
                const time = parseFloat(e.target.value.replace(/:/g, '.'));
                if (!isNaN(time)) {
                  setSelectionStart(Math.max(0, Math.min(time, duration)));
                }
              }}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="text-gray-300 text-sm mb-1 block">End Time</label>
            <Input
              type="text"
              value={formatTime(selectionEnd)}
              onChange={(e) => {
                const time = parseFloat(e.target.value.replace(/:/g, '.'));
                if (!isNaN(time)) {
                  setSelectionEnd(Math.min(duration, Math.max(time, 0)));
                }
              }}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
        </div>
      </div>

      {/* Export Controls */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white text-lg font-semibold">Export</h3>
            <p className="text-gray-400 text-sm">
              Duration: {formatTime(selectionEnd - selectionStart)}
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white px-3 py-2 rounded"
            >
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="flac">FLAC</option>
            </select>
            <Button
              onClick={() => setShowFormatDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Selection
            </Button>
          </div>
        </div>
      </div>

      {/* Format Confirmation Dialog */}
      {showFormatDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-white text-lg font-semibold mb-4 text-center">
              Export Selection
            </h3>
            <p className="text-gray-300 text-sm mb-6 text-center">
              Export {formatTime(selectionEnd - selectionStart)} as {format.toUpperCase()}
            </p>

            <div className="space-y-3">
              <Button
                onClick={handleExport}
                className="w-full bg-green-600 hover:bg-green-700 py-3"
              >
                <Download className="h-4 w-4 mr-2" />
                Export as {format.toUpperCase()}
              </Button>
            </div>

            <div className="mt-4 text-center">
              <Button
                onClick={() => setShowFormatDialog(false)}
                className="bg-white text-gray-800 hover:bg-gray-200 border border-gray-300"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualSplitEditor;