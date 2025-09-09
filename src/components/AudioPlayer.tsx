import React, { useState } from 'react';

const AudioPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(240); // 4 minutes

  const togglePlay = () => setIsPlaying(!isPlaying);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-900 py-20">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Preview & Download
          </h2>
          
          <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
            {/* Waveform Visualization */}
            <div className="mb-8">
              <div className="h-32 bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                <img
                  src="https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360817366_a5a1c9ff.webp"
                  alt="Audio waveform"
                  className="w-full h-full object-cover rounded-lg opacity-60"
                />
              </div>
            </div>

            {/* Player Controls */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={togglePlay}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 transition-colors duration-300"
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
                <div className="bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
              </div>
              
              <span className="text-gray-300 text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Download Options */}
            <div className="grid md:grid-cols-3 gap-4">
              <button className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-300">
                Download MP3
              </button>
              <button className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-300">
                Download WAV
              </button>
              <button className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-300">
                Download FLAC
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;