import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Play, Pause, Scissors, Square } from 'lucide-react';
import Waveform from './Waveform';

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
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(duration);
  const [format, setFormat] = useState('mp3');
  const [isWaveformReady, setIsWaveformReady] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [startTimeInput, setStartTimeInput] = useState('0:00');
  const [endTimeInput, setEndTimeInput] = useState('0:00');

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Parse time input (MM:SS or M:SS format)
  const parseTimeInput = (input: string): number | null => {
    if (!input.trim()) return null;
    
    // Handle MM:SS format
    const timeMatch = input.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10);
      const seconds = parseInt(timeMatch[2], 10);
      if (seconds >= 60) return null; // Invalid seconds
      return minutes * 60 + seconds;
    }
    
    // Handle decimal format (e.g., "1.5" for 1.5 seconds)
    const decimalMatch = input.match(/^(\d+(?:\.\d+)?)$/);
    if (decimalMatch) {
      return parseFloat(decimalMatch[1]);
    }
    
    return null;
  };

  // Validate time inputs
  const validateTimes = (start: number, end: number): string | null => {
    if (start < 0 || end < 0) return "Time cannot be negative";
    if (start > duration || end > duration) return "Time cannot exceed track duration";
    if (end <= start) return "End time must be greater than start time";
    return null;
  };

  // Handle start time change
  const handleStartTimeChange = (input: string) => {
    setStartTimeInput(input);
    const time = parseTimeInput(input);
    if (time !== null) {
      const clampedTime = Math.max(0, Math.min(time, duration));
      setSelectionStart(clampedTime);
      
      // Validate with current end time
      const error = validateTimes(clampedTime, selectionEnd);
      setTimeError(error);
    } else if (input.trim() === '') {
      setSelectionStart(0);
      const error = validateTimes(0, selectionEnd);
      setTimeError(error);
    }
  };

  // Handle end time change
  const handleEndTimeChange = (input: string) => {
    setEndTimeInput(input);
    const time = parseTimeInput(input);
    if (time !== null) {
      const clampedTime = Math.max(0, Math.min(time, duration));
      setSelectionEnd(clampedTime);
      
      // Validate with current start time
      const error = validateTimes(selectionStart, clampedTime);
      setTimeError(error);
    } else if (input.trim() === '') {
      setSelectionEnd(duration);
      const error = validateTimes(selectionStart, duration);
      setTimeError(error);
    }
  };

  // Sync input fields when selection changes from waveform
  useEffect(() => {
    setStartTimeInput(formatTime(selectionStart));
  }, [selectionStart]);

  useEffect(() => {
    setEndTimeInput(formatTime(selectionEnd));
  }, [selectionEnd]);

  // Export functionality
  const handleExport = () => {
    onExport(selectionStart, selectionEnd, format);
  };

  return (
    <div className="w-full space-y-6">
      {/* Waveform (Canvas/Pixi placeholder) */}
      <div className="bg-gray-800 rounded-lg p-6">
        {!isWaveformReady && (
          <div className="flex items-center space-x-3 mb-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
            <span className="text-white text-sm">Generating your waveform... This may take a few seconds to a couple of minutes, depending on the audio file size. Please wait for a better visualization!</span>
          </div>
        )}
        <Waveform
          audioUrl={audioUrl}
          expectedDuration={duration}
          selection={{ start: selectionStart, end: selectionEnd }}
          onSelectionChange={(s, e) => {
            if (typeof s === 'number') setSelectionStart(s);
            if (typeof e === 'number') setSelectionEnd(e);
          }}
          onWaveformReady={() => {
            console.log('Waveform ready (low-res)');
            setIsWaveformReady(true);
          }}
        />
      </div>

      {/* Selection Controls */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-gray-300 text-sm mb-1 block">Start Time</label>
            <Input
              type="text"
              placeholder="0:00"
              value={startTimeInput}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          <div>
            <label className="text-gray-300 text-sm mb-1 block">End Time</label>
            <Input
              type="text"
              placeholder="0:00"
              value={endTimeInput}
              onChange={(e) => handleEndTimeChange(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
        </div>
        
        {/* Error message */}
        {timeError && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{timeError}</p>
          </div>
        )}
        
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
              onClick={handleExport}
              disabled={!!timeError}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Selection
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualSplitEditor;