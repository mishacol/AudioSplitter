import React, { useEffect, useState } from 'react';

interface WaveformDisplayProps {
  audioUrl: string;
  className?: string;
}

const WaveformDisplay: React.FC<WaveformDisplayProps> = ({ audioUrl, className = '' }) => {
  const [waveformImage, setWaveformImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioUrl) return;

    const generateWaveform = async () => {
      setIsLoading(true);
      setError(null);
      setWaveformImage(null);

      try {
        const response = await fetch('http://localhost:5000/waveform', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: audioUrl }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setWaveformImage(imageUrl);
      } catch (err) {
        console.error('Waveform generation error:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate waveform');
      } finally {
        setIsLoading(false);
      }
    };

    generateWaveform();

    // Cleanup function
    return () => {
      if (waveformImage) {
        URL.revokeObjectURL(waveformImage);
      }
    };
  }, [audioUrl]);

  if (isLoading) {
    return (
      <div className={`bg-gray-700 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-gray-300 text-sm">Generating waveform...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-900/20 border border-red-500 rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center">
          <p className="text-red-400 text-sm">Failed to load waveform</p>
          <p className="text-red-300 text-xs mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (waveformImage) {
    return (
      <div className={`bg-gray-700 rounded-lg overflow-hidden ${className}`}>
        <img 
          src={waveformImage} 
          alt="Audio waveform" 
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={`bg-gray-700 rounded-lg flex items-center justify-center ${className}`}>
      <div className="text-center text-gray-400">
        <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <p className="text-sm">No waveform available</p>
      </div>
    </div>
  );
};

export default WaveformDisplay;

