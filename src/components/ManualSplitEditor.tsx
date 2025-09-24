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

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Export functionality
  const handleExport = () => {
    onExport(selectionStart, selectionEnd, format);
  };

  return (
    <div className="w-full space-y-6">
      {/* Waveform (Canvas/Pixi placeholder) */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-white text-lg font-semibold mb-4">Interactive Waveform</h3>
        <Waveform
          audioUrl={audioUrl}
          expectedDuration={duration}
          selection={{ start: selectionStart, end: selectionEnd }}
          onSelectionChange={(s, e) => {
            if (typeof s === 'number') setSelectionStart(s);
            if (typeof e === 'number') setSelectionEnd(e);
          }}
          onWaveformReady={() => console.log('Waveform ready (low-res)')}
        />
      </div>

      {/* Selection Controls */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-gray-300 text-sm mb-1 block">Start Time</label>
            <Input
              type="text"
              value={formatTime(selectionStart)}
              onChange={(e) => {
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
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
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