/**
 * Format file size in bytes to human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (!bytes || !isFinite(bytes)) return 'Unknown';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

/**
 * Generate filename for audio export
 */
export const generateAudioFilename = (
  title: string,
  startTime: number,
  endTime: number,
  format: string = 'mp3'
): string => {
  const sanitizedTitle = title
    .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 50); // Limit length
  
  // Generate timestamp for uniqueness
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2025-09-26T10-15-30
  
  return `${sanitizedTitle}_${timestamp}.${format}`;
};

/**
 * Format time for filename (from timeUtils)
 */
const formatTimeForFilename = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}-${minutes.toString().padStart(2, '0')}-${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes.toString().padStart(2, '0')}-${secs.toString().padStart(2, '0')}`;
};

/**
 * Validate audio format
 */
export const isValidAudioFormat = (format: string): boolean => {
  const validFormats = ['mp3', 'wav', 'flac', 'm4a', 'ogg'];
  return validFormats.includes(format.toLowerCase());
};

/**
 * Get MIME type for audio format
 */
export const getAudioMimeType = (format: string): string => {
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    'ogg': 'audio/ogg'
  };
  
  return mimeTypes[format.toLowerCase()] || 'audio/mpeg';
};
