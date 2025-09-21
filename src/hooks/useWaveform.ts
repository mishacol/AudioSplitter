import { useRef, useState, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import Hls from 'hls.js';

interface UseWaveformProps {
  audioUrl?: string;
  containerId: string;
  onReady?: () => void;
  onError?: (error: any) => void;
  onTimeUpdate?: (time: number) => void;
}

export const useWaveform = ({ 
  audioUrl, 
  containerId, 
  onReady, 
  onError, 
  onTimeUpdate 
}: UseWaveformProps) => {
  const waveformRef = useRef<WaveSurfer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!audioUrl) return;

    setIsLoading(true);
    setIsReady(false);
    console.log('🎵 Initializing Wavesurfer.js for:', audioUrl);

    // Destroy existing instance if any
    if (waveformRef.current) {
      waveformRef.current.destroy();
      waveformRef.current = null;
    }

    // Wait for DOM to be ready
    const initWavesurfer = () => {
      const container = document.getElementById(containerId);
      if (!container) {
        console.log('🎵 Container not ready, retrying...');
        setTimeout(initWavesurfer, 100);
        return;
      }

      console.log('🎵 Container found, creating Wavesurfer...');

      // Create Wavesurfer instance with MediaElement backend for streaming
      const wavesurfer = WaveSurfer.create({
        container,
        waveColor: '#6b7280',
        progressColor: '#3b82f6',
        height: 128,
        normalize: true,
        backend: 'MediaElement',
        mediaControls: false
      });

      waveformRef.current = wavesurfer;

      // Event listeners
      wavesurfer.on('ready', () => {
        console.log('✅ Real waveform построен с Wavesurfer.js!');
        console.log('🎵 Waveform container:', container);
        console.log('🎵 Container dimensions:', {
          width: container.clientWidth,
          height: container.clientHeight,
          offsetWidth: container.offsetWidth,
          offsetHeight: container.offsetHeight
        });
        console.log('🎵 Wavesurfer instance:', wavesurfer);
        
        setIsReady(true);
        setIsLoading(false);
        onReady?.();
      });

      wavesurfer.on('error', (error) => {
        console.error('❌ Wavesurfer error:', error);
        console.error('❌ Error details:', error.message || error);
        console.error('❌ Audio URL:', audioUrl);
        console.error('❌ Container element:', container);
        setIsLoading(false);
        onError?.(error);
      });

      wavesurfer.on('loading', (percent) => {
        console.log('🎵 Loading progress:', percent + '%');
      });

      wavesurfer.on('decode', () => {
        console.log('🎵 Audio decoded, waveform should be ready...');
      });

      wavesurfer.on('audioprocess', (time) => {
        onTimeUpdate?.(time);
      });

      // Load audio with HLS support
      console.log('🎵 Loading audio into Wavesurfer...');
      console.log('🎵 Audio URL:', audioUrl);
      
      // Check if URL is HLS stream
      if (audioUrl.includes('.m3u8') || audioUrl.includes('m3u8')) {
        console.log('🎵 Detected HLS stream, using HLS.js...');
        
        // Create HLS instance
        const hls = new Hls({
          enableWorker: false,
          lowLatencyMode: true
        });
        
        // Create video element for HLS
        const video = document.createElement('video');
        video.style.display = 'none';
        container.appendChild(video);
        
        // Load HLS stream
        hls.loadSource(audioUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('🎵 HLS manifest parsed, loading into Wavesurfer...');
          wavesurfer.load(video.src);
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('❌ HLS error:', data);
          setIsLoading(false);
          onError?.(data);
        });
        
      } else {
        // Regular audio URL
        console.log('🎵 Regular audio URL, loading directly...');
        console.log('🎵 URL type check:', {
          isLocalhost: audioUrl.includes('localhost'),
          isProxy: audioUrl.includes('/stream?url='),
          hasCors: audioUrl.includes('localhost:3001')
        });
        
        // Test URL accessibility first
        fetch(audioUrl, { method: 'HEAD' })
          .then(response => {
            console.log('🎵 URL accessibility test:', {
              status: response.status,
              contentType: response.headers.get('content-type'),
              cors: response.headers.get('access-control-allow-origin')
            });
            
            // Load into Wavesurfer
            wavesurfer.load(audioUrl);
          })
          .catch(error => {
            console.error('❌ URL accessibility test failed:', error);
            // Still try to load - might work despite CORS
            wavesurfer.load(audioUrl);
          });
      }
    };

    // Start initialization
    initWavesurfer();
    
    // Additional check after a delay to ensure container is ready
    setTimeout(() => {
      const container = document.getElementById(containerId);
      if (container && waveformRef.current) {
        console.log('🎵 Delayed container check:', {
          exists: !!container,
          dimensions: {
            width: container.clientWidth,
            height: container.clientHeight
          },
          wavesurferReady: !!waveformRef.current
        });
        
        // Check if waveform is visible
        if (container.clientWidth > 0) {
          console.log('🎵 Container is ready, waveform should be visible');
        }
      }
    }, 500);

    // Cleanup
    return () => {
      if (waveformRef.current) {
        waveformRef.current.destroy();
        waveformRef.current = null;
      }
      
      // Clean up HLS resources
      const container = document.getElementById(containerId);
      if (container) {
        const video = container.querySelector('video');
        if (video) {
          video.remove();
        }
      }
    };
  }, [audioUrl, containerId, onReady, onError, onTimeUpdate]);

  return {
    waveformRef,
    isLoading,
    isReady
  };
};
