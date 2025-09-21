import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Square } from 'lucide-react';

interface AudioControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  isPlaying,
  isLoading,
  onPlay,
  onPause,
  onStop,
  disabled = false
}) => {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={isPlaying ? onPause : onPlay}
        disabled={disabled || isLoading}
        className="flex items-center gap-2"
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {isPlaying ? 'Pause' : 'Play'}
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onStop}
        disabled={disabled || isLoading}
        className="flex items-center gap-2"
      >
        <Square className="h-4 w-4" />
        Stop
      </Button>
    </div>
  );
};
