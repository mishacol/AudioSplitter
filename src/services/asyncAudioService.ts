/**
 * Async Audio Service with Server-Sent Events
 * Handles real-time progress updates from the async backend
 */

export interface AudioJob {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  data?: any;
  timestamp: string;
}

export interface ProgressEvent {
  job_id: string;
  stage: string;
  progress: number;
  message: string;
  timestamp: string;
  data: any;
}

export class AsyncAudioService {
  private baseUrl = 'http://localhost:5000';
  private eventSources: Map<string, EventSource> = new Map();

  /**
   * Start async audio processing
   */
  async startProcessing(audioUrl: string): Promise<AudioJob> {
    const response = await fetch(`${this.baseUrl}/preload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: audioUrl }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start processing: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get current job progress
   */
  async getProgress(jobId: string): Promise<AudioJob> {
    const response = await fetch(`${this.baseUrl}/progress/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get progress: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Subscribe to real-time progress updates via Server-Sent Events
   */
  subscribeToProgress(
    jobId: string, 
    onProgress: (event: ProgressEvent) => void,
    onError?: (error: Event) => void,
    onComplete?: () => void
  ): () => void {
    // Close existing connection if any
    this.unsubscribeFromProgress(jobId);

    const eventSource = new EventSource(`${this.baseUrl}/progress/${jobId}/stream`);
    this.eventSources.set(jobId, eventSource);

    eventSource.onmessage = (event) => {
      try {
        const progressEvent: ProgressEvent = JSON.parse(event.data);
        onProgress(progressEvent);
        
        // Check if processing is complete
        if (progressEvent.stage === 'workflow' && progressEvent.progress === 100) {
          onComplete?.();
          this.unsubscribeFromProgress(jobId);
        }
      } catch (error) {
        console.error('Error parsing progress event:', error);
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
   * Get peaks data for a job
   */
  async getPeaks(jobId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/peaks/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get peaks: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get audio file URL for a job
   */
  async getAudioUrl(jobId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/audio/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get audio: ${response.statusText}`);
    }

    const data = await response.json();
    return `${this.baseUrl}${data.url}`;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  /**
   * List all active jobs
   */
  async listJobs(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/jobs`);
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
  }
}

// Export singleton instance
export const asyncAudioService = new AsyncAudioService();
