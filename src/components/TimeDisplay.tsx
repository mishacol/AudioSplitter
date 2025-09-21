import React from 'react';
import { formatTime } from '@/utils/timeUtils';

interface TimeDisplayProps {
  currentTime: number;
  duration: number;
  className?: string;
}

export const TimeDisplay: React.FC<TimeDisplayProps> = ({ 
  currentTime, 
  duration, 
  className = '' 
}) => {
  return (
    <div className={`text-sm text-gray-300 ${className}`}>
      {formatTime(currentTime)} / {formatTime(duration)}
    </div>
  );
};
