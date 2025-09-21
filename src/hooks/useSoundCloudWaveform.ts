import { useState, useEffect } from 'react';
import { SoundCloudService } from '@/services/soundcloudService';

interface UseSoundCloudWaveformProps {
  audioUrl?: string;
  onWaveformReady?: (waveformData: number[]) => void;
  onError?: (error: any) => void;
}

export const useSoundCloudWaveform = ({ 
  audioUrl, 
  onWaveformReady, 
  onError 
}: UseSoundCloudWaveformProps) => {
  const [waveformData, setWaveformData] = useState<number[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioUrl || !SoundCloudService.isSoundCloudUrl(audioUrl)) {
      setWaveformData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    console.log('🎵 Loading SoundCloud waveform for:', audioUrl);

    const loadSoundCloudWaveform = async () => {
      try {
        const { track, waveform } = await SoundCloudService.getTrackWithWaveform(audioUrl);
        
        if (track && waveform) {
          const convertedWaveform = SoundCloudService.convertWaveformData(waveform);
          setWaveformData(convertedWaveform);
          onWaveformReady?.(convertedWaveform);
          console.log('✅ SoundCloud waveform loaded:', {
            trackTitle: track.title,
            duration: track.duration,
            waveformPoints: convertedWaveform.length
          });
        } else {
          throw new Error('Failed to load SoundCloud waveform data');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        onError?.(err);
        console.error('❌ SoundCloud waveform error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSoundCloudWaveform();
  }, [audioUrl, onWaveformReady, onError]);

  return {
    waveformData,
    isLoading,
    error,
    isSoundCloud: audioUrl ? SoundCloudService.isSoundCloudUrl(audioUrl) : false
  };
};
