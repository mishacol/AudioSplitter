import React, { useRef, useEffect } from 'react';

interface SoundCloudWaveformProps {
  waveformData: number[];
  duration: number;
  currentTime: number;
  startTime: number;
  endTime: number;
  onTimeClick?: (time: number) => void;
  className?: string;
}

export const SoundCloudWaveform: React.FC<SoundCloudWaveformProps> = ({
  waveformData,
  duration,
  currentTime,
  startTime,
  endTime,
  onTimeClick,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Draw waveform
    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;
    const barWidth = width / waveformData.length;

    // Draw background
    ctx.fillStyle = 'rgba(51, 63, 72, 0.1)';
    ctx.fillRect(0, 0, width, height);

    // Draw waveform bars
    waveformData.forEach((amplitude, index) => {
      const x = index * barWidth;
      const barHeight = amplitude * height * 0.8; // Scale amplitude
      
      // Color based on selection
      let color = '#6b7280'; // Default gray
      const time = (index / waveformData.length) * duration;
      
      if (time >= startTime && time <= endTime) {
        color = '#3b82f6'; // Blue for selected area
      }
      
      ctx.fillStyle = color;
      ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
    });

    // Draw progress line
    const progressX = (currentTime / duration) * width;
    ctx.strokeStyle = '#ef4444'; // Red progress line
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(progressX, 0);
    ctx.lineTo(progressX, height);
    ctx.stroke();

    // Draw selection handles
    const startX = (startTime / duration) * width;
    const endX = (endTime / duration) * width;

    // Start handle
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(startX - 4, 0, 8, height);
    
    // End handle
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(endX - 4, 0, 8, height);

  }, [waveformData, duration, currentTime, startTime, endTime]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onTimeClick) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    
    onTimeClick(time);
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      className={`w-full h-32 rounded cursor-pointer ${className}`}
      style={{ backgroundColor: 'rgba(51, 63, 72, 0.1)' }}
    />
  );
};
