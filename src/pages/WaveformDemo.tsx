import React from 'react';
import WaveformEditor from '../components/WaveformEditor';

const WaveformDemo: React.FC = () => {
  const handleExport = (startTime: number, endTime: number, format: string, fadeIn: boolean, fadeOut: boolean) => {
    console.log('Export:', { startTime, endTime, format, fadeIn, fadeOut });
    alert(`Exporting: ${startTime}s to ${endTime}s as ${format.toUpperCase()}${fadeIn ? ' with fade in' : ''}${fadeOut ? ' with fade out' : ''}`);
  };

  return (
    <WaveformEditor
      audioUrl="https://www.soundjay.com/misc/sounds/bell-ringing-05.wav"
      duration={300}
      onExport={handleExport}
    />
  );
};

export default WaveformDemo;
