interface SoundCloudTrack {
  id: number;
  title: string;
  user: {
    username: string;
    avatar_url: string;
  };
  artwork_url: string;
  duration: number;
  waveform_url: string;
  stream_url: string;
  permalink_url: string;
}

interface SoundCloudWaveform {
  waveform_url: string;
  waveform_data?: number[];
}

export class SoundCloudService {
  private static readonly SOUNDCLOUD_CLIENT_ID = 'YOUR_SOUNDCLOUD_CLIENT_ID'; // Нужно получить
  private static readonly SOUNDCLOUD_API_BASE = 'https://api.soundcloud.com';

  /**
   * Check if URL is a SoundCloud URL
   */
  static isSoundCloudUrl(url: string): boolean {
    return url.includes('soundcloud.com');
  }

  /**
   * Extract track ID from SoundCloud URL
   */
  static extractTrackId(url: string): string | null {
    try {
      // Handle different SoundCloud URL formats:
      // https://soundcloud.com/user/track-name
      // https://soundcloud.com/user/track-name/sets/playlist-name
      // https://soundcloud.com/track-name
      
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part);
      
      if (pathParts.length >= 2) {
        // For user/track format
        return pathParts[1];
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get track info from SoundCloud API
   */
  static async getTrackInfo(url: string): Promise<SoundCloudTrack | null> {
    try {
      const trackId = this.extractTrackId(url);
      if (!trackId) return null;

      // Use SoundCloud oEmbed API (no client ID needed)
      const oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      
      const response = await fetch(oembedUrl);
      if (!response.ok) return null;

      const data = await response.json();
      
      // Extract track ID from HTML
      const trackIdMatch = data.html.match(/tracks\/(\d+)/);
      if (!trackIdMatch) return null;

      const numericTrackId = trackIdMatch[1];
      
      // Get track details (this requires client ID)
      const trackUrl = `${this.SOUNDCLOUD_API_BASE}/tracks/${numericTrackId}?client_id=${this.SOUNDCLOUD_CLIENT_ID}`;
      
      const trackResponse = await fetch(trackUrl);
      if (!trackResponse.ok) return null;

      const trackData = await trackResponse.json();
      
      return {
        id: trackData.id,
        title: trackData.title,
        user: {
          username: trackData.user.username,
          avatar_url: trackData.user.avatar_url
        },
        artwork_url: trackData.artwork_url || trackData.user.avatar_url,
        duration: Math.floor(trackData.duration / 1000), // Convert to seconds
        waveform_url: trackData.waveform_url,
        stream_url: trackData.stream_url,
        permalink_url: trackData.permalink_url
      };
    } catch (error) {
      console.error('SoundCloud API error:', error);
      return null;
    }
  }

  /**
   * Get waveform data from SoundCloud
   */
  static async getWaveformData(waveformUrl: string): Promise<number[] | null> {
    try {
      // SoundCloud waveform URL returns a JSON array of amplitude values
      const response = await fetch(waveformUrl);
      if (!response.ok) return null;

      const waveformData = await response.json();
      
      // SoundCloud returns an array of numbers (amplitudes)
      if (Array.isArray(waveformData)) {
        return waveformData;
      }
      
      return null;
    } catch (error) {
      console.error('SoundCloud waveform error:', error);
      return null;
    }
  }

  /**
   * Get complete track info with waveform
   */
  static async getTrackWithWaveform(url: string): Promise<{
    track: SoundCloudTrack | null;
    waveform: number[] | null;
  }> {
    const track = await this.getTrackInfo(url);
    if (!track) {
      return { track: null, waveform: null };
    }

    const waveform = await this.getWaveformData(track.waveform_url);
    
    return { track, waveform };
  }

  /**
   * Convert SoundCloud waveform to our format
   */
  static convertWaveformData(soundcloudData: number[]): number[] {
    // SoundCloud waveform data is already normalized (0-100)
    // Convert to our format (0-1)
    return soundcloudData.map(value => value / 100);
  }
}
