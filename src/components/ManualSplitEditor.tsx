import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Play, Pause, Scissors } from 'lucide-react';

interface ManualSplitEditorProps {
  audioBlobUrl: string;
  duration: number;
  onExport: (startTime: number, endTime: number, format: string) => void;
}

const ManualSplitEditor: React.FC<ManualSplitEditorProps> = ({
  audioBlobUrl,
  duration,
  onExport,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(duration);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(duration);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | 'move' | null>(null);
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  // Parse time input helper
  const parseTime = (timeStr: string) => {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const [mins, secs] = parts;
      return parseInt(mins) * 60 + parseFloat(secs);
    }
    return 0;
  };

  // Update audio element
  useEffect(() => {
    if (audioRef.current && audioBlobUrl) {
      audioRef.current.src = audioBlobUrl;
    }
  }, [audioBlobUrl]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Handle play/pause
  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Playback failed:', error);
      }
    }
  };

  // Handle waveform click
  const handleWaveformClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickTime = (x / rect.width) * duration;
    
    // Seek audio to clicked position
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, clickTime));
      setCurrentTime(audioRef.current.currentTime);
    }
    
    // Update selection based on click position
    if (clickTime < selectionStart + (selectionEnd - selectionStart) / 2) {
      setSelectionStart(clickTime);
      setStartTime(clickTime);
    } else {
      setSelectionEnd(clickTime);
      setEndTime(clickTime);
    }
  };

  // Handle mouse down for dragging
  const handleMouseDown = (event: React.MouseEvent, type: 'start' | 'end' | 'move') => {
    event.preventDefault();
    setIsDragging(true);
    setDragType(type);
  };

  // Handle mouse move for dragging
  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !waveformRef.current) return;

    const rect = waveformRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickTime = Math.max(0, Math.min(duration, (x / rect.width) * duration));

    if (dragType === 'start') {
      const newStart = Math.min(clickTime, selectionEnd - 0.1);
      setSelectionStart(newStart);
      setStartTime(newStart);
    } else if (dragType === 'end') {
      const newEnd = Math.max(clickTime, selectionStart + 0.1);
      setSelectionEnd(newEnd);
      setEndTime(newEnd);
    } else if (dragType === 'move') {
      const delta = clickTime - (selectionStart + selectionEnd) / 2;
      const newStart = Math.max(0, selectionStart + delta);
      const newEnd = Math.min(duration, selectionEnd + delta);
      
      if (newStart >= 0 && newEnd <= duration) {
        setSelectionStart(newStart);
        setSelectionEnd(newEnd);
        setStartTime(newStart);
        setEndTime(newEnd);
      }
    }
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
    setDragType(null);
  };

  // Handle time input changes
  const handleStartTimeChange = (value: string) => {
    const time = parseTime(value);
    if (time >= 0 && time < endTime) {
      setStartTime(time);
      setSelectionStart(time);
    }
  };

  const handleEndTimeChange = (value: string) => {
    const time = parseTime(value);
    if (time > startTime && time <= duration) {
      setEndTime(time);
      setSelectionEnd(time);
    }
  };

  // Show format selection dialog
  const handleImportClick = () => {
    setShowFormatDialog(true);
  };

  // Handle format selection
  const handleFormatSelect = async (format: string) => {
    setShowFormatDialog(false);
    
    // Create a temporary link element to trigger file download
    const link = document.createElement('a');
    link.style.display = 'none';
    
    // Generate filename based on selection
    const startTimeStr = formatTime(startTime).replace(/:/g, '-');
    const endTimeStr = formatTime(endTime).replace(/:/g, '-');
    const filename = `audio_selection_${startTimeStr}_to_${endTimeStr}.${format}`;
    
    try {
      // For now, we'll call the export function and let the parent handle the actual file creation
      // In a real implementation, you'd create the audio segment here
      onExport(startTime, endTime, format);
      
      // Show success message
      console.log(`Would save file as: ${filename}`);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  // Handle playback seek
  const handlePlaybackSeek = (e: React.MouseEvent) => {
    if (!waveformRef.current) return;
    
    const rect = waveformRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newTime = (x / 800) * duration;
    
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, newTime));
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Generate real waveform data from audio
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isGeneratingWaveform, setIsGeneratingWaveform] = useState(false);

  useEffect(() => {
    if (!audioBlobUrl) return;

    const generateRealWaveform = async () => {
      setIsGeneratingWaveform(true);
      try {
        // Create audio context to analyze the audio
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const response = await fetch(audioBlobUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Get audio data
        const channelData = audioBuffer.getChannelData(0); // Use first channel
        const samples = channelData.length;
        const width = 800;
        const samplesPerPixel = Math.floor(samples / width);
        
        // Downsample and normalize
        const waveform = [];
        for (let i = 0; i < width; i++) {
          const start = i * samplesPerPixel;
          const end = Math.min(start + samplesPerPixel, samples);
          
          let sum = 0;
          for (let j = start; j < end; j++) {
            sum += Math.abs(channelData[j]);
          }
          
          const average = sum / (end - start);
          waveform.push(average);
        }
        
        setWaveformData(waveform);
      } catch (error) {
        console.error('Error generating waveform:', error);
        // Fallback to mock data
        const mockData = Array.from({ length: 800 }, (_, i) => 
          Math.sin(i * 0.02) * 0.8 + Math.sin(i * 0.05) * 0.3
        );
        setWaveformData(mockData);
      } finally {
        setIsGeneratingWaveform(false);
      }
    };

    generateRealWaveform();
  }, [audioBlobUrl]);
  const startX = (selectionStart / duration) * 800;
  const endX = (selectionEnd / duration) * 800;
  const playbackX = (currentTime / duration) * 800;

  return (
    <div className="w-full space-y-6">
      {/* Hidden audio element */}
      <audio ref={audioRef} className="hidden" />
      
      {/* Waveform Display */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div 
          ref={waveformRef}
          className="relative cursor-pointer select-none"
          onClick={handleWaveformClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Waveform SVG */}
          <svg width="800" height="120" className="w-full h-32">
            <rect width="100%" height="100%" fill="#374151" />
            
            {/* Waveform */}
            {isGeneratingWaveform ? (
              <text x="400" y="60" textAnchor="middle" fill="#6B7280" fontSize="14">
                Generating waveform...
              </text>
            ) : (
              <g stroke="#6B7280" strokeWidth="1" fill="none">
                {waveformData.map((amplitude, index) => {
                  const x = index;
                  const y1 = 60 - amplitude * 30;
                  const y2 = 60 + amplitude * 30;
                  return <line key={index} x1={x} y1={y1} x2={x} y2={y2} />;
                })}
              </g>
            )}
            
            {/* Selection overlay */}
            <rect
              x={startX}
              y="0"
              width={endX - startX}
              height="120"
              fill="#3B82F6"
              opacity="0.3"
            />
            
            {/* Selection border */}
            <rect
              x={startX}
              y="0"
              width={endX - startX}
              height="120"
              fill="none"
              stroke="#FCD34D"
              strokeWidth="3"
            />
            
            {/* Start handle */}
            <rect
              x={startX - 2}
              y="0"
              width="4"
              height="120"
              fill="#FCD34D"
              cursor="ew-resize"
              onMouseDown={(e) => handleMouseDown(e, 'start')}
            />
            
            {/* End handle */}
            <rect
              x={endX - 2}
              y="0"
              width="4"
              height="120"
              fill="#FCD34D"
              cursor="ew-resize"
              onMouseDown={(e) => handleMouseDown(e, 'end')}
            />
            
            {/* Move handle (center) */}
            <rect
              x={(startX + endX) / 2 - 10}
              y="0"
              width="20"
              height="120"
              fill="none"
              stroke="#FCD34D"
              strokeWidth="2"
              cursor="move"
              onMouseDown={(e) => handleMouseDown(e, 'move')}
            />
            
            {/* Playback progress line */}
            <line
              x1={playbackX}
              y1="0"
              x2={playbackX}
              y2="120"
              stroke="#EF4444"
              strokeWidth="2"
              className="cursor-pointer"
              onMouseDown={(e) => handlePlaybackSeek(e)}
            />
            
            {/* Playback progress handle */}
            <circle
              cx={playbackX}
              cy="10"
              r="6"
              fill="#EF4444"
              className="cursor-pointer"
              onMouseDown={(e) => handlePlaybackSeek(e)}
            />
          </svg>
          
          {/* Time markers */}
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i}>{formatTime((duration / 5) * i)}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Play button */}
        <Button
          onClick={togglePlayPause}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        {/* Time display */}
        <div className="text-white">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Time inputs */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-center mb-4">
          <h3 className="text-white font-medium">Cut from:</h3>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-gray-300 text-sm mb-2">Start</label>
            <Input
              value={formatTime(startTime)}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder="0:00.00"
            />
          </div>
          
          <div className="text-gray-300 mt-6">to</div>
          
          <div className="flex-1">
            <label className="block text-gray-300 text-sm mb-2">End</label>
            <Input
              value={formatTime(endTime)}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder="0:00.00"
            />
          </div>
        </div>
      </div>

      {/* Import button */}
      <div className="text-center">
        <Button
          onClick={handleImportClick}
          className="bg-green-600 hover:bg-green-700 px-8 py-3"
        >
          <Download className="h-5 w-5 mr-2" />
          Import Selection ({formatTime(endTime - startTime)})
        </Button>
      </div>

      {/* Format Selection Dialog */}
      {showFormatDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-white text-lg font-semibold mb-4 text-center">
              Select Format
            </h3>
            <p className="text-gray-300 text-sm mb-6 text-center">
              Choose the format for your audio selection
            </p>
            
            <div className="space-y-3">
              <Button
                onClick={() => handleFormatSelect('mp3')}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3"
              >
                <Download className="h-4 w-4 mr-2" />
                Save as MP3
              </Button>
              
              <Button
                onClick={() => handleFormatSelect('wav')}
                className="w-full bg-green-600 hover:bg-green-700 py-3"
              >
                <Download className="h-4 w-4 mr-2" />
                Save as WAV
              </Button>
              
              <Button
                onClick={() => handleFormatSelect('flac')}
                className="w-full bg-purple-600 hover:bg-purple-700 py-3"
              >
                <Download className="h-4 w-4 mr-2" />
                Save as FLAC
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
