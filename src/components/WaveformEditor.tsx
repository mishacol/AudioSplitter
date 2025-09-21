import React, { useState } from 'react';
import CompetitorWaveform from './CompetitorWaveform';

interface WaveformEditorProps {
  audioUrl: string;
  duration: number;
  onExport?: (startTime: number, endTime: number, format: string, fadeIn: boolean, fadeOut: boolean) => void;
}

const WaveformEditor: React.FC<WaveformEditorProps> = ({
  audioUrl,
  duration,
  onExport
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(duration);
  const [action, setAction] = useState<'extract' | 'delete'>('extract');
  const [format, setFormat] = useState('mp3');
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleSelectionChange = (start: number, end: number) => {
    setSelectionStart(start);
    setSelectionEnd(end);
  };

  const handleExport = () => {
    onExport?.(selectionStart, selectionEnd, format, fadeIn, fadeOut);
  };

  return (
    <div className="bg-gray-900 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Audio Editor</h1>
            <p className="text-gray-400">Professional audio editing with precise waveform control</p>
          </div>

          {/* Main Editor */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Waveform Area */}
            <div className="lg:col-span-3">
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-white text-lg font-semibold mb-4">Waveform Editor</h2>
                
                <CompetitorWaveform
                  audioUrl={audioUrl}
                  duration={duration}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  onTimeUpdate={handleTimeUpdate}
                  onSelectionChange={handleSelectionChange}
                  className="w-full"
                />
              </div>
            </div>

            {/* Right Panel - Controls */}
            <div className="lg:col-span-1">
              <div className="bg-gray-800 rounded-lg p-6 space-y-6">
                
                {/* Action Selection */}
                <div>
                  <h3 className="text-white font-semibold mb-3">Action</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="action"
                        value="extract"
                        checked={action === 'extract'}
                        onChange={(e) => setAction(e.target.value as 'extract' | 'delete')}
                        className="mr-2 text-blue-500"
                      />
                      <span className="text-white">Extract Selected</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="action"
                        value="delete"
                        checked={action === 'delete'}
                        onChange={(e) => setAction(e.target.value as 'extract' | 'delete')}
                        className="mr-2 text-blue-500"
                      />
                      <span className="text-white">Delete Selected</span>
                    </label>
                  </div>
                </div>

                {/* Cut From */}
                <div>
                  <h3 className="text-white font-semibold mb-3">Cut from:</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="text"
                      value={formatTime(selectionStart)}
                      onChange={(e) => {
                        // Простая валидация времени
                        const time = parseFloat(e.target.value.replace(':', '.'));
                        if (!isNaN(time)) setSelectionStart(time);
                      }}
                      className="w-20 px-2 py-1 bg-gray-700 text-white rounded text-center"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="text"
                      value={formatTime(selectionEnd)}
                      onChange={(e) => {
                        const time = parseFloat(e.target.value.replace(':', '.'));
                        if (!isNaN(time)) setSelectionEnd(time);
                      }}
                      className="w-20 px-2 py-1 bg-gray-700 text-white rounded text-center"
                    />
                  </div>
                </div>

                {/* Fade Options */}
                <div>
                  <h3 className="text-white font-semibold mb-3">Fade Options</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={fadeIn}
                        onChange={(e) => setFadeIn(e.target.checked)}
                        className="mr-2 text-blue-500"
                      />
                      <span className="text-white">Fade in</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={fadeOut}
                        onChange={(e) => setFadeOut(e.target.checked)}
                        className="mr-2 text-blue-500"
                      />
                      <span className="text-white">Fade out</span>
                    </label>
                  </div>
                </div>

                {/* Format Selection */}
                <div>
                  <h3 className="text-white font-semibold mb-3">Format</h3>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                  >
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                    <option value="flac">FLAC</option>
                    <option value="m4a">M4A</option>
                  </select>
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExport}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                >
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Info */}
          <div className="mt-6 bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="text-gray-400">
                Final output — {formatTime(selectionEnd - selectionStart)}
              </div>
              <div className="text-gray-400">
                Format — {format.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaveformEditor;