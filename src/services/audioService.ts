interface AudioMetadata {
  title?: string;
  author?: string;
  album?: string;
  duration?: number;
  thumbnail?: string;
  format?: string;
  bitrate?: string;
  fileSize?: string;
  url?: string;
  direct_audio_url?: string;
  waveform_data?: number[]; // For SoundCloud tracks
}

interface AudioResolutionResult {
  url: string | null;
  duration?: number | null;
  is_progressive?: boolean | null;
  title?: string | null;
  format?: string | null;
  bitrate?: string | null;
  fileSize?: string | null;
  thumbnail?: string | null;
  waveform_data?: number[]; // For SoundCloud tracks
  author?: string | null;
  release_date_formatted?: string | null;
}

import { SoundCloudService } from './soundcloudService';

export class AudioService {
  private static readonly PYTHON_BACKEND_URL = 'http://localhost:5000';
  private static readonly NODE_STREAM_URL = 'http://localhost:3001';

  /**
   * Extract metadata from audio URL using Python backend
   */
  static async extractMetadata(url: string): Promise<AudioMetadata | null> {
    try {
      console.log('Fetching metadata from Python backend for:', url);
      
      const response = await fetch(`${this.PYTHON_BACKEND_URL}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('HTTP error:', response.status, errorText);
        return null;
      }
      
      const data = await response.json();
      console.log('🔍 Backend metadata response:', data);
      console.log('🔍 Available keys:', Object.keys(data));
      
      if (data.error) {
        console.error('Backend error:', data.error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Network error:', error);
      return null;
    }
  }

  /**
   * Resolve streaming URL with metadata extraction
   */
  static async resolveStreamingUrl(url: string): Promise<AudioResolutionResult | null> {
    try {
      // Check if it's a SoundCloud URL first
      if (SoundCloudService.isSoundCloudUrl(url)) {
        console.log('🎵 Detected SoundCloud URL, using SoundCloud API...');
        
        const { track, waveform } = await SoundCloudService.getTrackWithWaveform(url);
        
        if (track) {
          const streamUrl = `${this.NODE_STREAM_URL}/stream?url=${encodeURIComponent(track.stream_url)}`;
          
          const result: AudioResolutionResult = {
            url: streamUrl,
            duration: track.duration,
            is_progressive: true,
            title: track.title,
            format: 'mp3', // SoundCloud typically streams MP3
            bitrate: '128k', // Default SoundCloud bitrate
            fileSize: null,
            thumbnail: track.artwork_url,
            waveform_data: waveform ? SoundCloudService.convertWaveformData(waveform) : undefined
          };
          
          console.log('🎵 SoundCloud result:', result);
          return result;
        }
      }
      
      // Fallback to Python backend for other URLs
      console.log('🎵 Using Python backend for non-SoundCloud URL...');
      const metadata = await this.extractMetadata(url);
      
      if (metadata) {
        // For YouTube/SoundCloud, use the Node.js streaming server
        const streamUrl = metadata.direct_audio_url 
          ? `${this.NODE_STREAM_URL}/stream?url=${encodeURIComponent(metadata.direct_audio_url)}` 
          : null;
        
        const result: AudioResolutionResult = { 
          url: streamUrl, 
          duration: metadata.duration ?? null, 
          is_progressive: true, 
          title: metadata.title ?? null,
          format: metadata.format ?? null,
          bitrate: metadata.bitrate ?? null,
          fileSize: metadata.filesize_formatted ?? null,
          thumbnail: metadata.thumbnail ?? null,
          waveform_data: metadata.waveform_data,
          author: metadata.author ?? null,
          release_date_formatted: metadata.release_date_formatted ?? null
        };
        
        console.log('🔍 Mapped result for frontend:', result);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('URL resolution failed:', error);
      return null;
    }
  }

  /**
   * Get fallback streaming URL directly from Node.js server
   */
  static getFallbackStreamUrl(originalUrl: string): string {
    return `${this.NODE_STREAM_URL}/stream?url=${encodeURIComponent(originalUrl)}`;
  }

  /**
   * Check if URL is already proxied
   */
  static isProxiedUrl(url: string): boolean {
    return url.startsWith(`${this.NODE_STREAM_URL}/stream`);
  }

  /**
   * Extract original URL from proxied URL
   */
  static extractOriginalUrl(proxiedUrl: string): string | null {
    try {
      const url = new URL(proxiedUrl);
      return url.searchParams.get('url');
    } catch {
      return null;
    }
  }
}
