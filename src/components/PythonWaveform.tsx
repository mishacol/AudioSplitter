import React, { useState, useEffect } from 'react';

interface PythonWaveformProps {
  audioBlobUrl: string;
  onSplitPointAdd: (time: number) => void;
  onSplitPointRemove: (index: number) => void;
  splitPoints: number[];
  duration: number;
}

const PythonWaveform: React.FC<PythonWaveformProps> = ({
  audioBlobUrl,
  onSplitPointAdd,
  onSplitPointRemove,
  splitPoints,
  duration,
}) => {
  const [waveformImage, setWaveformImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate waveform image when audio blob or split points change
  useEffect(() => {
    if (!audioBlobUrl) return;

    const generateWaveform = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // For now, we'll create a mock waveform image
        // In production, this would call the Python backend
        const mockWaveform = createMockWaveform(duration, splitPoints);
        setWaveformImage(mockWaveform);
      } catch (err) {
        setError('Failed to generate waveform');
        console.error('Waveform generation error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    generateWaveform();
  }, [audioBlobUrl, splitPoints, duration]);

  const createMockWaveform = (duration: number, splitPoints: number[]): string => {
    // Create a simple SVG waveform for demonstration
    const width = 800;
    const height = 120;
    const centerY = height / 2;
    
    // Generate mock waveform data
    const points = [];
    for (let i = 0; i < width; i += 4) {
      const x = i;
      const amplitude = Math.sin(i * 0.02) * 0.8 + Math.sin(i * 0.05) * 0.3;
      const y1 = centerY - amplitude * 40;
      const y2 = centerY + amplitude * 40;
      points.push(`M${x},${y1} L${x},${y2}`);
    }

    // Create split point markers
    const markers = splitPoints.map((point, index) => {
      const x = (point / duration) * width;
      return `
        <line x1="${x}" y1="10" x2="${x}" y2="${height - 10}" stroke="#EF4444" stroke-width="2" opacity="0.8"/>
        <circle cx="${x}" cy="15" r="8" fill="#EF4444"/>
        <text x="${x}" y="20" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${index + 1}</text>
      `;
    }).join('');

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#374151"/>
        <g stroke="#4F46E5" stroke-width="1" fill="none">
          ${points.map(path => `<path d="${path}"/>`).join('')}
        </g>
        <g fill="#4F46E5" opacity="0.3">
          ${points.map(path => `<path d="${path}"/>`).join('')}
        </g>
        ${markers}
      </svg>
    `;

    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  const handleWaveformClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickTime = (x / rect.width) * duration;
    
    if (clickTime >= 0 && clickTime <= duration) {
      onSplitPointAdd(clickTime);
    }
  };

  const handleMarkerClick = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    onSplitPointRemove(index);
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="bg-gray-600 rounded-lg h-32 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-300 text-sm">Generating waveform...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="bg-red-900/20 border border-red-500 rounded-lg h-32 flex items-center justify-center">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="bg-gray-600 rounded-lg p-4">
        <div 
          className="relative cursor-pointer"
          onClick={handleWaveformClick}
        >
          {waveformImage && (
            <img 
              src={waveformImage} 
              alt="Audio waveform" 
              className="w-full h-32 object-contain rounded"
            />
          )}
          
          {/* Click overlay for better UX */}
          <div className="absolute inset-0 bg-transparent hover:bg-blue-500/10 transition-colors rounded"></div>
        </div>
        
        <div className="mt-3 text-center">
          <p className="text-gray-300 text-sm">
            Click on the waveform to add split points • Click markers to remove
          </p>
        </div>
      </div>
    </div>
  );
};

export default PythonWaveform;
