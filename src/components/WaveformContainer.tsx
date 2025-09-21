import React from 'react';

interface WaveformContainerProps {
  isLoading: boolean;
  containerId: string;
}

export const WaveformContainer: React.FC<WaveformContainerProps> = ({ 
  isLoading, 
  containerId 
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 rounded" style={{ backgroundColor: 'rgba(51, 63, 72, 0.1)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-300">Loading waveform...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      id={containerId}
      className="w-full rounded"
      style={{ 
        width: '100%', 
        height: '128px',
        backgroundColor: 'rgba(51, 63, 72, 0.1)',
        minHeight: '128px'
      }}
    />
  );
};
