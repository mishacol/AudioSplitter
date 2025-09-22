/**
 * Progressive Waveform Component
 * Implements Step 3: Low → High progressive waveform with hot-swapping
 */
import React, { useEffect, useRef, useState } from 'react';
import Peaks from 'peaks.js';
import { progressiveAudioService, ProgressivePeaks, MultiResolutionPeaks } from '@/services/progressiveAudioService';

interface ProgressiveWaveformProps {
  audioUrl: string;
  jobId?: string;
  progress?: number;
  onPeaksReady?: (peaks: ProgressivePeaks) => void;
  onResolutionChange?: (resolution: string, points: number) => void;
}

const ProgressiveWaveform: React.FC<ProgressiveWaveformProps> = ({
  audioUrl,
  jobId,
  progress = 0,
  onPeaksReady,
  onResolutionChange
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const overviewContainerRef = useRef<HTMLDivElement | null>(null);
  const zoomviewContainerRef = useRef<HTMLDivElement | null>(null);
  const peaksInstanceRef = useRef<any>(null);
  
  const [isPeaksReady, setIsPeaksReady] = useState(false);
  const [currentResolution, setCurrentResolution] = useState<string>('overview');
  const [currentPoints, setCurrentPoints] = useState<number>(1024);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Peaks.js with progressive loading
  useEffect(() => {
    if (!audioRef.current || !overviewContainerRef.current || !zoomviewContainerRef.current) {
      return;
    }

    const initializePeaks = async () => {
      try {
        setIsLoading(true);
        
        // Ensure containers are visible and have proper dimensions
        const overviewContainer = overviewContainerRef.current!;
        const zoomviewContainer = zoomviewContainerRef.current!;
        
        overviewContainer.style.display = 'block';
        overviewContainer.style.width = '100%';
        overviewContainer.style.height = '150px';
        overviewContainer.style.minHeight = '150px';
        
        zoomviewContainer.style.display = 'block';
        zoomviewContainer.style.width = '100%';
        zoomviewContainer.style.height = '100px';
        zoomviewContainer.style.minHeight = '100px';
        
        // Add delay to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Initialize Peaks.js with proper callback
        const peaksInstance = await Peaks.init({
          container: overviewContainerRef.current!,
          mediaElement: audioRef.current!,
          webAudio: {
            audioContext: new AudioContext()
          },
          keyboard: true,
          pointMarkerColor: '#FF0000',
          segmentStartMarkerColor: '#FF0000',
          segmentEndMarkerColor: '#FF0000',
          zoomLevels: [512, 1024, 2048, 4096, 8192, 16384, 32768],
          overview: {
            container: overviewContainerRef.current!,
            waveformColor: '#4F46E5',
            playedWaveformColor: '#10B981',
            showPlayheadTime: true
          },
          zoomview: {
            container: zoomviewContainerRef.current!,
            waveformColor: '#4F46E5',
            playedWaveformColor: '#10B981',
            showPlayheadTime: true
          }
        }, (err, peaks) => {
          if (err) {
            console.error('Peaks.js initialization error:', err);
            setIsLoading(false);
            return;
          }
          
          console.log('Peaks.js initialized successfully');
          peaksInstanceRef.current = peaks;
          setIsPeaksReady(true);
          setIsLoading(false);
          console.log('🔧 Set isLoading to false after Peaks.js init');
          
          // Start progressive loading if jobId is provided
          if (jobId) {
            startProgressiveLoading(jobId, peaks);
          }
        });
        
        // Fallback timeout to hide loading indicator
        setTimeout(() => {
          if (isLoading) {
            console.log('🔧 Fallback: hiding loading indicator after timeout');
            setIsLoading(false);
          }
        }, 5000);
        
      } catch (error) {
        console.error('Peaks.js initialization error:', error);
        setIsLoading(false);
      }
    };

    initializePeaks();

    return () => {
      if (peaksInstanceRef.current) {
        peaksInstanceRef.current.destroy();
      }
    };
  }, [audioUrl, jobId]);

  // Progressive loading function
  const startProgressiveLoading = async (jobId: string, peaksInstance: any) => {
    try {
      // Subscribe to progressive updates
      const unsubscribe = progressiveAudioService.subscribeToProgressive(
        jobId,
        (event) => {
          console.log('📊 Progressive update:', event.message);
        },
        (lowResPeaks) => {
          // Low-res peaks ready - display immediately
          console.log('⚡ Low-res peaks ready:', lowResPeaks.points, 'points');
          setCurrentResolution('overview');
          setCurrentPoints(lowResPeaks.points);
          onPeaksReady?.(lowResPeaks);
          setIsLoading(false);
          console.log('🔧 Set isLoading to false after low-res peaks ready');
        },
        (multiResPeaks) => {
          // Multi-resolution peaks ready - start hot-swapping
          console.log('🔥 Multi-res peaks ready, starting hot-swap...');
          startHotSwapping(jobId, peaksInstance, multiResPeaks);
        },
        (error) => {
          console.error('Progressive loading error:', error);
          setIsLoading(false);
        },
        () => {
          console.log('✅ Progressive loading complete');
          setIsLoading(false);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('Progressive loading failed:', error);
      setIsLoading(false);
    }
  };

  // Hot-swapping function
  const startHotSwapping = async (jobId: string, peaksInstance: any, multiResPeaks: MultiResolutionPeaks) => {
    const resolutionLevels = ['overview', 'zoom_1', 'zoom_2', 'zoom_3', 'zoom_4', 'zoom_5'];
    
    for (let i = 1; i < resolutionLevels.length; i++) {
      const resolution = resolutionLevels[i];
      
      if (resolution in multiResPeaks) {
        try {
          // Wait a bit before hot-swapping
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const peaks = multiResPeaks[resolution as keyof MultiResolutionPeaks];
          
          // Hot-swap to higher resolution
          if (peaksInstance.setWaveformData) {
            peaksInstance.setWaveformData(peaks.peaks);
            setCurrentResolution(resolution);
            setCurrentPoints(peaks.points);
            onResolutionChange?.(resolution, peaks.points);
            
            console.log(`🔥 Hot-swapped to ${resolution} (${peaks.points} points)`);
          }
        } catch (error) {
          console.error(`Hot-swap to ${resolution} failed:`, error);
          break;
        }
      }
    }
  };

  // Manual hot-swap function (for user interaction)
  const handleHotSwap = async () => {
    if (jobId && peaksInstanceRef.current) {
      const nextPeaks = await progressiveAudioService.hotSwapToHigherResolution(
        jobId,
        currentResolution,
        peaksInstanceRef.current
      );
      
      if (nextPeaks) {
        setCurrentResolution(nextPeaks.resolution);
        setCurrentPoints(nextPeaks.points);
        onResolutionChange?.(nextPeaks.resolution, nextPeaks.points);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Loading indicator */}
      {(() => {
        console.log('🔍 ProgressiveWaveform isLoading:', isLoading, 'progress:', progress);
        return isLoading;
      })() && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-300">Analyzing track... {Math.round(progress)}%</span>
        </div>
      )}


      {/* Overview waveform */}
      <div className="bg-gray-700 rounded p-2">
        <div className="text-xs text-gray-400 mb-2">Overview</div>
        <div 
          ref={overviewContainerRef} 
          style={{ width: '100%', height: '150px' }}
          className="bg-gray-800 rounded border"
        />
      </div>

      {/* Zoomview waveform */}
      <div className="bg-gray-700 rounded p-2">
        <div className="text-xs text-gray-400 mb-2">Zoom View</div>
        <div 
          ref={zoomviewContainerRef} 
          style={{ width: '100%', height: '100px' }}
          className="bg-gray-800 rounded border"
        />
      </div>

      {/* Hidden audio element */}
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        className="hidden" 
        preload="auto"
        crossOrigin="anonymous"
      />
    </div>
  );
};

export default ProgressiveWaveform;
