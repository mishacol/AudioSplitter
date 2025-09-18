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
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [format, setFormat] = useState('mp3');
  const [directAudioUrl, setDirectAudioUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Resolve audio URL when component mounts
  useEffect(() => {
    const resolveUrl = async () => {
      if (audioUrl) {
        setIsLoading(true);
        const directUrl = await resolveAudioUrl(audioUrl);
        if (directUrl) {
          setDirectAudioUrl(directUrl);
        } else {
          console.error('Failed to resolve audio URL');
        }
        setIsLoading(false);
      }
    };
    
    resolveUrl();
  }, [audioUrl]);

  // Get direct audio URL from resolve endpoint
  const resolveAudioUrl = async (url: string) => {
    try {
      const response = await fetch('http://localhost:3001/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      return data.url; // Direct audio URL
    } catch (error) {
      console.error('Failed to resolve audio URL:', error);
      return null;
    }
  };

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
      const width = 2400;
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
    ctx.fillStyle = '#3B82F6'; // Lighter blue with glow
    
    waveformData.forEach((amplitude, index) => {
      const x = (index / waveformData.length) * width;
      const barHeight = amplitude * centerY * 1.6;
      const barWidth = width / waveformData.length;
      
      // Draw glow effect (slightly larger and more transparent)
      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)'; // Glow color
      ctx.fillRect(x - 1, centerY - barHeight / 2 - 1, barWidth + 2, barHeight + 2);
      
      // Draw main bar
      ctx.fillStyle = '#3B82F6'; // Main blue color
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    });



  }, [waveformData, selectionStart, selectionEnd, currentTime, duration]);

  // Audio controls
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Handle autoplay restrictions
      audio.play().catch(error => {
        console.error('Audio play failed:', error);
        setIsPlaying(false);
        // Show user-friendly error message
        alert('Audio playback failed. Please try clicking the play button again.');
      });
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

  // Handle mouse move over canvas
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate time at mouse position using actual rendered canvas dimensions
    const timeAtMouse = Math.max(0, Math.min(duration, (x / rect.width) * duration));
    
    // Use relative coordinates within the canvas container
    setMousePosition({ x: x, y: y });
    setHoverTime(timeAtMouse);
  };

  // Handle mouse leave canvas
  const handleCanvasMouseLeave = () => {
    setMousePosition(null);
    setHoverTime(null);
  };




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
        src={directAudioUrl ? `http://localhost:3001/stream?url=${encodeURIComponent(directAudioUrl)}` : undefined}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onEnded={() => setIsPlaying(false)}
        onError={(e) => {
          console.error('Audio error:', e);
          setIsPlaying(false);
        }}
        onLoadStart={() => console.log('Audio loading started')}
        onCanPlay={() => console.log('Audio can play')}
        preload="metadata"
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Waveform Display */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="mb-4">
        </div>

        {/* Waveform Canvas */}
        <div className="relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 rounded" style={{ backgroundColor: 'rgba(51, 63, 72, 0.1)' }}>
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-gray-300">Loading waveform...</p>
              </div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={2400}
              height={240}
              className="w-full h-64 rounded"
              style={{ backgroundColor: 'rgba(51, 63, 72, 0.1)' }}
              onClick={handleCanvasClick}
              onMouseMove={handleCanvasMouseMove}
              onMouseLeave={handleCanvasMouseLeave}
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
            disabled={isLoading || !directAudioUrl}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:from-gray-600 disabled:to-gray-600"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Loading...
              </>
            ) : (
              <>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isPlaying ? 'Pause' : 'Play'}
              </>
            )}
          </Button>
          
        </div>

        <div className="text-center text-gray-300 text-sm">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Selection Controls */}
      <div className="bg-gray-800 rounded-lg p-4">

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
            <p className="text-gray-400 text-sm">
              Selected area duration: {formatTime(selectionEnd - selectionStart)}
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
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Import Selection
            </Button>
          </div>
        </div>
      </div>

      {/* Format Confirmation Dialog */}
      {showFormatDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-white text-lg font-semibold mb-4 text-center">
              Import Selection
            </h3>
            <p className="text-gray-300 text-sm mb-6 text-center">
              Import {formatTime(selectionEnd - selectionStart)} as {format.toUpperCase()}
            </p>

            <div className="space-y-3">
              <Button
                onClick={handleExport}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 py-3"
              >
                <Download className="h-4 w-4 mr-2" />
                Import as {format.toUpperCase()}
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