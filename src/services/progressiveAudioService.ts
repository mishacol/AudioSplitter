/**
 * Progressive Audio Service
 * Implements Step 3: Low → High progressive waveform for <10s UX
 */
export interface ProgressivePeaks {
  peaks: number[][];
  points: number;
  duration: number;
  sample_rate: number;
  source: string;
  resolution: string;
}

export interface MultiResolutionPeaks {
  overview: ProgressivePeaks;
  zoom_1: ProgressivePeaks;
  zoom_2: ProgressivePeaks;
  zoom_3: ProgressivePeaks;
  zoom_4: ProgressivePeaks;
  zoom_5: ProgressivePeaks;
}

export interface ProgressiveJob {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  data?: any;
  timestamp: string;
}

export interface ProgressiveEvent {
  job_id: string;
  stage: string;
  progress: number;
  message: string;
  timestamp: string;
  data: any;
}

export interface DownloadedAudioInfo {
  file_path: string;
  url: string;
}

export class ProgressiveAudioService {
  private baseUrl = 'http://localhost:5002';
  private eventSources: Map<string, EventSource> = new Map();
  private currentPeaks: ProgressivePeaks | null = null;
  private multiResPeaks: MultiResolutionPeaks | null = null;
  private downloadedAudioUrl: string | null = null;

  /**
   * Start progressive audio processing
   */
  async startProgressiveProcessing(audioUrl: string): Promise<ProgressiveJob> {
    const response = await fetch(`${this.baseUrl}/preload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: audioUrl }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start progressive processing: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Subscribe to progressive updates
   */
  subscribeToProgressive(
    jobId: string, 
    onProgress: (event: ProgressiveEvent) => void,
    onLowResReady?: (peaks: ProgressivePeaks) => void,
    onHighResReady?: (multiRes: MultiResolutionPeaks) => void,
    onDownloadedAudioReady?: (audioInfo: DownloadedAudioInfo) => void,
    onError?: (error: Event) => void,
    onComplete?: () => void
  ): () => void {
    // Close existing connection if any
    this.unsubscribeFromProgress(jobId);

    const eventSource = new EventSource(`${this.baseUrl}/progress/${jobId}/stream`);
    this.eventSources.set(jobId, eventSource);

    eventSource.onmessage = (event) => {
      try {
        const progressEvent: ProgressiveEvent = JSON.parse(event.data);
        onProgress(progressEvent);
        
        // Handle different stages
        switch (progressEvent.stage) {
          case 'processing':
            if (progressEvent.data && progressEvent.data.low_res_peaks) {
              this.currentPeaks = progressEvent.data.low_res_peaks;
              onLowResReady?.(this.currentPeaks);
            }
            if (progressEvent.data && progressEvent.data.multi_res_peaks) {
              this.multiResPeaks = progressEvent.data.multi_res_peaks;
              onHighResReady?.(this.multiResPeaks);
            }
            // Check for downloaded audio file
            if (progressEvent.data && progressEvent.data.file_path) {
              const audioInfo: DownloadedAudioInfo = {
                file_path: progressEvent.data.file_path,
                url: `${this.baseUrl}/downloads/${progressEvent.data.file_path.split('/').pop()}`
              };
              this.downloadedAudioUrl = audioInfo.url;
              onDownloadedAudioReady?.(audioInfo);
            }
            break;
          case 'completed':
            onComplete?.();
            this.unsubscribeFromProgress(jobId);
            break;
        }
      } catch (error) {
        console.error('Error parsing progressive event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      onError?.(error);
    };

    // Return unsubscribe function
    return () => this.unsubscribeFromProgress(jobId);
  }

  /**
   * Get specific resolution peaks
   */
  async getPeaksResolution(jobId: string, resolution: string): Promise<ProgressivePeaks> {
    const response = await fetch(`${this.baseUrl}/peaks/${jobId}/${resolution}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get ${resolution} peaks: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get current low-res peaks
   */
  getCurrentPeaks(): ProgressivePeaks | null {
    return this.currentPeaks;
  }

  /**
   * Get multi-resolution peaks
   */
  getMultiResPeaks(): MultiResolutionPeaks | null {
    return this.multiResPeaks;
  }

  /**
   * Get downloaded audio URL
   */
  getDownloadedAudioUrl(): string | null {
    return this.downloadedAudioUrl;
  }

  /**
   * Hot-swap to higher resolution in Peaks.js
   */
  async hotSwapToHigherResolution(
    jobId: string, 
    currentResolution: string,
    peaksInstance: any
  ): Promise<ProgressivePeaks | null> {
    try {
      // Determine next resolution level
      const resolutionLevels = ['overview', 'zoom_1', 'zoom_2', 'zoom_3', 'zoom_4', 'zoom_5'];
      const currentIndex = resolutionLevels.indexOf(currentResolution);
      
      if (currentIndex === -1 || currentIndex >= resolutionLevels.length - 1) {
        return null; // Already at highest resolution
      }
      
      const nextResolution = resolutionLevels[currentIndex + 1];
      
      // Get higher resolution peaks
      const higherResPeaks = await this.getPeaksResolution(jobId, nextResolution);
      
      // Hot-swap in Peaks.js
      if (peaksInstance && peaksInstance.setWaveformData) {
        peaksInstance.setWaveformData(higherResPeaks.peaks);
        console.log(`🔥 Hot-swapped to ${nextResolution} (${higherResPeaks.points} points)`);
      }
      
      return higherResPeaks;
    } catch (error) {
      console.error('Hot-swap failed:', error);
      return null;
    }
  }

  /**
   * Progressive loading strategy
   */
  async progressiveLoad(
    jobId: string,
    peaksInstance: any,
    onProgress: (resolution: string, points: number) => void
  ): Promise<void> {
    const resolutionLevels = ['overview', 'zoom_1', 'zoom_2', 'zoom_3', 'zoom_4', 'zoom_5'];
    
    for (const resolution of resolutionLevels) {
      try {
        const peaks = await this.getPeaksResolution(jobId, resolution);
        
        if (peaksInstance && peaksInstance.setWaveformData) {
          peaksInstance.setWaveformData(peaks.peaks);
          onProgress(resolution, peaks.points);
          
          // Add delay between resolutions for smooth transition
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.log(`Resolution ${resolution} not ready yet`);
        break;
      }
    }
  }

  /**
   * Unsubscribe from progress updates
   */
  unsubscribeFromProgress(jobId: string): void {
    const eventSource = this.eventSources.get(jobId);
    if (eventSource) {
      eventSource.close();
      this.eventSources.delete(jobId);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    this.eventSources.forEach((eventSource) => {
      eventSource.close();
    });
    this.eventSources.clear();
    this.currentPeaks = null;
    this.multiResPeaks = null;
  }
}

// Export singleton instance
export const progressiveAudioService = new ProgressiveAudioService();
