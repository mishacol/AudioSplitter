import React, { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Rect, Text } from 'react-konva';

interface CompetitorWaveformProps {
  audioUrl: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate?: (time: number) => void;
  onSelectionChange?: (startTime: number, endTime: number) => void;
  className?: string;
}

const CompetitorWaveform: React.FC<CompetitorWaveformProps> = ({
  audioUrl,
  duration,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onSelectionChange,
  className = ''
}) => {
  const stageRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectionStart, setSelectionStart] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState(duration);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | 'move' | null>(null);

  const width = 920;
  const height = 200;
  const timelineHeight = 30;

  // Generate mock waveform data (заменить на реальные данные с бэкенда)
  useEffect(() => {
    if (duration > 0) {
      const samples = Math.floor(width / 2);
      const mockData = Array.from({ length: samples }, (_, i) => {
        const progress = i / samples;
        const time = progress * duration;
        // Создаем реалистичную waveform с пиками и тишиной
        const baseAmplitude = Math.sin(progress * Math.PI * 8) * 0.3;
        const noise = (Math.random() - 0.5) * 0.2;
        const silence = time > 200 && time < 250 ? 0.1 : 1; // Тишина в середине
        return Math.max(0, Math.min(1, (baseAmplitude + noise) * silence));
      });
      setWaveformData(mockData);
      setIsLoading(false);
    }
  }, [duration, width]);

  // Audio element setup
  useEffect(() => {
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      onTimeUpdate?.(time);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', () => {
      setIsLoading(false);
    });

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.pause();
    };
  }, [audioUrl, onTimeUpdate]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timeToX = (time: number): number => {
    return (time / duration) * width;
  };

  const xToTime = (x: number): number => {
    return (x / width) * duration;
  };

  const handleMouseDown = (e: any) => {
    const x = e.evt.offsetX;
    const time = xToTime(x);
    
    // Определяем что кликнули
    const startX = timeToX(selectionStart);
    const endX = timeToX(selectionEnd);
    const handleSize = 10;

    if (Math.abs(x - startX) < handleSize) {
      setDragType('start');
    } else if (Math.abs(x - endX) < handleSize) {
      setDragType('end');
    } else if (x > startX && x < endX) {
      setDragType('move');
    } else {
      // Новое выделение
      setSelectionStart(time);
      setSelectionEnd(time + 1);
      setDragType('end');
    }
    
    setIsDragging(true);
  };

  const handleMouseMove = (e: any) => {
    if (!isDragging) return;

    const x = e.evt.offsetX;
    const time = Math.max(0, Math.min(duration, xToTime(x)));

    if (dragType === 'start') {
      setSelectionStart(time);
    } else if (dragType === 'end') {
      setSelectionEnd(time);
    } else if (dragType === 'move') {
      const delta = time - (selectionStart + selectionEnd) / 2;
      const newStart = Math.max(0, selectionStart + delta);
      const newEnd = Math.min(duration, selectionEnd + delta);
      setSelectionStart(newStart);
      setSelectionEnd(newEnd);
    }

    onSelectionChange?.(selectionStart, selectionEnd);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragType(null);
  };

  const renderWaveform = () => {
    const lines: any[] = [];
    const centerY = height / 2;
    const amplitude = 80;

    for (let i = 0; i < waveformData.length; i++) {
      const x = (i / waveformData.length) * width;
      const amplitudeValue = waveformData[i] * amplitude;
      
      // Верхняя часть waveform
      lines.push(
        <Line
          key={`top-${i}`}
          points={[x, centerY - amplitudeValue, x, centerY]}
          stroke="#4A90E2"
          strokeWidth={2}
          lineCap="round"
        />
      );
      
      // Нижняя часть waveform
      lines.push(
        <Line
          key={`bottom-${i}`}
          points={[x, centerY, x, centerY + amplitudeValue]}
          stroke="#4A90E2"
          strokeWidth={2}
          lineCap="round"
        />
      );
    }

    return lines;
  };

  const renderTimeline = () => {
    const marks = [];
    const interval = duration > 300 ? 30 : 10; // Интервал в секундах
    
    for (let time = 0; time <= duration; time += interval) {
      const x = timeToX(time);
      marks.push(
        <Line
          key={`mark-${time}`}
          points={[x, height, x, height + 10]}
          stroke="#666"
          strokeWidth={1}
        />
      );
      
      marks.push(
        <Text
          key={`text-${time}`}
          x={x - 15}
          y={height + 15}
          text={formatTime(time)}
          fontSize={12}
          fill="#999"
        />
      );
    }
    
    return marks;
  };

  const renderPlayhead = () => {
    const x = timeToX(currentTime);
    return (
      <Line
        points={[x, 0, x, height]}
        stroke="#fff"
        strokeWidth={2}
        shadowColor="#fff"
        shadowBlur={4}
      />
    );
  };

  const renderSelection = () => {
    const startX = timeToX(selectionStart);
    const endX = timeToX(selectionEnd);
    const selectionWidth = endX - startX;

    return (
      <Rect
        x={startX}
        y={0}
        width={selectionWidth}
        height={height}
        fill="rgba(255, 235, 59, 0.2)"
        stroke="#FFEB3B"
        strokeWidth={2}
      />
    );
  };

  const renderHandles = () => {
    const startX = timeToX(selectionStart);
    const endX = timeToX(selectionEnd);

    return (
      <>
        {/* Start handle */}
        <Rect
          x={startX - 5}
          y={height / 2 - 10}
          width={10}
          height={20}
          fill="#FFEB3B"
          stroke="#FFC107"
          strokeWidth={1}
          cornerRadius={2}
        />
        
        {/* End handle */}
        <Rect
          x={endX - 5}
          y={height / 2 - 10}
          width={10}
          height={20}
          fill="#FFEB3B"
          stroke="#FFC107"
          strokeWidth={1}
          cornerRadius={2}
        />
      </>
    );
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-black rounded-lg ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-300">Loading waveform...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Waveform Container */}
      <div className="relative">
        <Stage
          width={width}
          height={height + timelineHeight}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          ref={stageRef}
        >
          <Layer>
            {/* Waveform */}
            {renderWaveform()}
            
            {/* Selection overlay */}
            {renderSelection()}
            
            {/* Playhead */}
            {renderPlayhead()}
            
            {/* Selection handles */}
            {renderHandles()}
          </Layer>
          
          <Layer>
            {/* Timeline */}
            {renderTimeline()}
          </Layer>
        </Stage>
      </div>

      {/* Media Controls */}
      <div className="flex items-center justify-between p-4 bg-gray-800">
        <div className="flex-1"></div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (audioRef.current) {
                if (isPlaying) {
                  audioRef.current.pause();
                } else {
                  audioRef.current.play();
                }
              }
            }}
            className="w-8 h-8 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <div className="w-3 h-3 bg-white rounded-sm"></div>
            ) : (
              <div className="w-0 h-0 border-l-4 border-l-white border-t-2 border-t-transparent border-b-2 border-b-transparent ml-1"></div>
            )}
          </button>
        </div>
        
        <div className="flex-1 text-right">
          <span className="text-white font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CompetitorWaveform;
