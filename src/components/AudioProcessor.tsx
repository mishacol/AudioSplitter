import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Wand2, Scissors, Loader2, ArrowLeft } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/use-toast';
import ManualSplitEditor from './ManualSplitEditor';
import { AudioService } from '@/services';
import { progressiveAudioService, ProgressiveEvent } from '@/services/progressiveAudioService';
import ProgressiveWaveform from './ProgressiveWaveform';
import Waveform from './Waveform';

const AudioProcessor: React.FC = () => {
  const [audioUrl, setAudioUrl] = useState('');
  const [audioFetched, setAudioFetched] = useState(false);
  const [splitMode, setSplitMode] = useState<'automatic' | 'manual' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPulse, setShowPulse] = useState(true);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasTriedStreamFallback, setHasTriedStreamFallback] = useState(false);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveProgress, setResolveProgress] = useState(0);
  const [trackTitle, setTrackTitle] = useState<string | null>(null);
  const [audioFormat, setAudioFormat] = useState<string | null>(null);
  const [audioBitrate, setAudioBitrate] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [trackImage, setTrackImage] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  
  // Job tracking for non-blocking processing
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<string>('');
  const [jobMessage, setJobMessage] = useState<string>('');
  const [lowResPeaks, setLowResPeaks] = useState<any>(null);
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Animate progress smoothly with realistic increments
  useEffect(() => {
    const targetProgress = jobProgress;
    const startProgress = animatedProgress;
    
    // If target is higher, animate up with realistic increments
    if (targetProgress > startProgress) {
      const duration = 2000; // 2 seconds for smooth animation
      const startTime = Date.now();
      const increment = 0.5; // Update every 0.5%
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentProgress = startProgress + (targetProgress - startProgress) * easeOutCubic;
        
        setAnimatedProgress(currentProgress);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    } else {
      // If target is lower or same, set immediately
      setAnimatedProgress(targetProgress);
    }
  }, [jobProgress]);

  // Function to stop playback and reset audio state
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Start progressive audio processing
  const startProgressiveProcessing = async (url: string) => {
    try {
      // Start progressive processing
      const job = await progressiveAudioService.startProgressiveProcessing(url);
      setCurrentJobId(job.job_id);
      setJobStatus(job.status);
      setJobProgress(0);
      setJobMessage('Starting progressive processing...');

      // Subscribe to progressive updates
      const unsubscribe = subscribeToProgressive(job.job_id);
      
      // Show player immediately with HLS audio
      setAudioFetched(true);
      setIsProcessing(false);
      
      return unsubscribe;
    } catch (error) {
      console.error('Failed to start progressive processing:', error);
      setJobStatus('error');
      setJobMessage(`Error: ${error}`);
      toast({ 
        title: 'Processing Error', 
        description: 'Failed to start audio processing. Please try again.', 
        variant: 'destructive' as any 
      });
      return null;
    }
  };

  // Subscribe to progressive updates - simplified, let ProgressiveWaveform handle the details
  const subscribeToProgressive = (jobId: string) => {
    const unsubscribe = progressiveAudioService.subscribeToProgressive(
      jobId,
      (event: ProgressiveEvent) => {
        console.log('📊 Progressive event:', event);
        
        setJobStatus('processing');
        setJobProgress(event.progress);
        setJobMessage(event.message);
      },
      undefined, // Let ProgressiveWaveform handle low-res peaks
      undefined, // Let ProgressiveWaveform handle multi-res peaks
      (error) => {
        console.error('Progressive loading error:', error);
        setJobStatus('error');
        setJobMessage('Connection error');
      },
      () => {
        console.log('✅ Progressive processing complete');
        setJobStatus('completed');
        setJobProgress(100);
        setJobMessage('Processing complete!');
        console.log('🔧 Setting jobStatus to completed - spinner should hide');
      }
    );

    return unsubscribe;
  };

  // Poll job progress
  const pollJobProgress = async (jobId: string) => {
    try {
      const response = await fetch(`http://localhost:5000/progress/${jobId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const progress = await response.json();
      setJobProgress(progress.progress);
      setJobStatus(progress.status);
      setJobMessage(progress.message);
      
      // Check if peaks data is available in progress data
      if (progress.data && progress.data.low_res_peaks) {
        setLowResPeaks(progress.data.low_res_peaks);
        console.log('Low-res peaks loaded from progress:', progress.data.low_res_peaks);
      }
      
      // If job is completed, get final peaks data
      if (progress.status === 'completed') {
        try {
          const peaksResponse = await fetch(`http://localhost:5000/peaks/${jobId}`);
          if (peaksResponse.ok) {
            const peaksData = await peaksResponse.json();
            setLowResPeaks(peaksData);
            console.log('Final peaks loaded:', peaksData);
          }
        } catch (error) {
          console.error('Failed to load peaks data:', error);
        }
        
        // Stop polling
        return;
      }
      
      // If job is still processing, continue polling
      if (progress.status === 'processing' || progress.status === 'queued') {
        setTimeout(() => pollJobProgress(jobId), 1000); // Poll every second
      }
      
    } catch (error) {
      console.error('Failed to get job progress:', error);
      setJobStatus('error');
      setJobMessage('Failed to get progress');
    }
  };

  // Start non-blocking audio processing
  const startNonBlockingProcessing = async (url: string) => {
    try {
      const response = await fetch('http://localhost:5000/preload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio_url: url }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      setCurrentJobId(result.job_id);
      setJobStatus(result.status);
      setJobMessage(result.message);
      
      // Start polling for progress
      pollJobProgress(result.job_id);
      
      // Show player immediately with HLS audio
      setAudioFetched(true);
      setIsProcessing(false);
      
    } catch (error) {
      console.error('Failed to start processing:', error);
      toast({ 
        title: 'Processing Error', 
        description: 'Failed to start audio processing. Please try again.', 
        variant: 'destructive' as any 
      });
    }
  };

  // Resolve audio URL immediately when audioUrl changes (like Manual Split)
  useEffect(() => {
    const resolveUrl = async () => {
      if (audioUrl && isStreamingPlatformUrl(audioUrl)) {
        // Clear previous state first
        setAudioFetched(false);
        setTrackTitle(null);
        setAudioFormat(null);
        setAudioBitrate(null);
        setFileSize(null);
        setTrackImage(null);
        setDuration(0);
        setCurrentTime(0);
        setIsPlaying(false);
        setResolvedAudioUrl(null);
        setSplitMode(null); // Reset split mode when processing new URL
        
        setIsResolving(true);
        setResolveProgress(0);
        console.log('Auto-resolving URL:', audioUrl);
        
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setResolveProgress(prev => {
            if (prev >= 90) return prev;
            return Math.min(prev + Math.random() * 15, 90);
          });
        }, 200);
        
        try {
          console.log('Starting metadata extraction for:', audioUrl);
          
          // Set up a timeout for metadata extraction
          const metadataPromise = resolveStreamingUrl(audioUrl);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Metadata extraction timeout')), 30000)
          );
          
          const resolved = await Promise.race([metadataPromise, timeoutPromise]) as { url: string | null; duration?: number | null; is_progressive?: boolean | null; title?: string | null; format?: string | null; bitrate?: string | null; fileSize?: string | null; thumbnail?: string | null } | null;
          clearInterval(progressInterval);
          setResolveProgress(100);
          
          console.log('Metadata extraction result:', resolved);
          
          if (resolved?.url) {
            setResolvedAudioUrl(resolved.url);
            if (resolved.duration) {
              setDuration(resolved.duration);
            }
            
            // Don't start progressive processing automatically - only when Manual Split is clicked
            // startProgressiveProcessing(resolved.url);
            if (resolved.title) {
              setTrackTitle(resolved.title);
            }
            if (resolved.format) {
              setAudioFormat(resolved.format);
            }
            if (resolved.bitrate) {
              setAudioBitrate(resolved.bitrate);
            }
            if (resolved.fileSize) {
              setFileSize(resolved.fileSize);
            }
            if (resolved.thumbnail) {
              setTrackImage(resolved.thumbnail);
            }
            // Save full metadata for additional fields
            setMetadata(resolved);
            setAudioFetched(true);
            console.log('Auto-resolved URL:', resolved.url);
          } else if (!resolved) {
            // Fallback: use Node.js streaming directly
            console.log('🔍 Metadata extraction failed, using direct streaming fallback');
            const streamUrl = `http://localhost:3001/stream?url=${encodeURIComponent(audioUrl)}`;
            console.log('🔍 Fallback stream URL:', streamUrl);
            setResolvedAudioUrl(streamUrl);
            setAudioFetched(true);
            setResolveProgress(100);
          }
        } catch (error) {
          clearInterval(progressInterval);
          console.error('URL resolution failed:', error);
          
          // Fallback: use Node.js streaming directly
          console.log('Using fallback streaming approach');
          const streamUrl = `http://localhost:3001/stream?url=${encodeURIComponent(audioUrl)}`;
          setResolvedAudioUrl(streamUrl);
          setAudioFetched(true);
          setResolveProgress(100);
        } finally {
          setTimeout(() => {
            setIsResolving(false);
            setResolveProgress(0);
          }, 500);
        }
      } else if (audioUrl) {
        // Direct URL, use it directly
        setResolvedAudioUrl(audioUrl);
        setAudioFetched(true);
      }
    };
    
    resolveUrl();
  }, [audioUrl]);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [splitSegments, setSplitSegments] = useState<any[]>([]);
  const [showErrorPopup, setShowErrorPopup] = useState(false);

  const isStreamingPlatformUrl = (url: string) => {
    try {
      const { hostname } = new URL(url);
      return [
        'soundcloud.com',
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'music.youtube.com',
        'youtu.be',
        'open.spotify.com',
      ].some((domain) => hostname.endsWith(domain));
    } catch {
      return false;
    }
  };

  const resolveStreamingUrl = async (url: string) => {
    return AudioService.resolveStreamingUrl(url);
  };

  useEffect(() => {
    const timer = setTimeout(() => setShowPulse(false), 2000);
    return () => clearTimeout(timer);
  }, []);


  const attachAudioListeners = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const onLoaded = () => {
      const elDuration = isFinite(audio.duration) ? audio.duration : 0;
      setDuration((prev) => (prev > 0 ? prev : elDuration));
      setAudioFetched(true);
      setIsProcessing(false);
    };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);
    const onError = async () => {
      // Try proxy fallback once if it's a streaming URL
      const currentSrc = audio.currentSrc || audio.src;
      if (currentSrc && currentSrc.includes('/stream')) {
        // We're already using the proxy stream; suppress noisy error toast
        setIsProcessing(false);
        // keep preview open
        setAudioFetched(true);
        return;
      }
      if (isStreamingPlatformUrl(audioUrl) && !hasTriedStreamFallback && audioUrl) {
        try {
          setHasTriedStreamFallback(true);
          // First resolve the URL to get direct audio URL
          console.log('Resolving URL:', audioUrl);
          const resolveResponse = await fetch('http://localhost:3001/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: audioUrl })
          });
          
          console.log('Resolve response status:', resolveResponse.status);
          
          if (resolveResponse.ok) {
            const resolveData = await resolveResponse.json();
            const directUrl = resolveData.url;
            console.log('Direct URL resolved:', directUrl);
            const streamUrl = `http://localhost:3001/stream?url=${encodeURIComponent(directUrl)}`;
            console.log('Stream URL:', streamUrl);
            audio.src = streamUrl;
            console.log('Audio src set to:', audio.src);
            audio.load();
            console.log('Audio load() called');
            // Defer playback to a user gesture to avoid autoplay restrictions
            setIsPlaying(false);
            setAudioFetched(true);
            return;
          } else {
            console.error('Resolve failed:', resolveResponse.status, await resolveResponse.text());
          }
        } catch {
          // fall through to error toast
        }
      }
      setIsProcessing(false);
      // don't collapse the preview; user can try again or switch source
      setAudioFetched(Boolean(audioFetched));
      setIsPlaying(false);
      toast({ title: 'Unable to load audio', description: 'The URL might not be a direct audio file or is blocked by CORS.', variant: 'destructive' as any });
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('canplay', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('canplay', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  };

  useEffect(() => {
    return attachAudioListeners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleSplitAudio = async () => {
    if (!splitMode || !audioUrl) return;
    setIsProcessing(true);
    
    try {
      if (splitMode === 'manual') {
        if (splitPoints.length === 0) {
          toast({ title: 'No split points', description: 'Please add at least one split point.', variant: 'destructive' as any });
          setIsProcessing(false);
          return;
        }
        
        const response = await fetch('http://localhost:3001/split', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: audioUrl, 
            splitPoints: splitPoints.sort((a, b) => a - b),
            format: 'mp3'
          }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Splitting failed');
        }
        
        const result = await response.json();
        setSplitSegments(result.segments || []);
        setIsProcessed(true);
        toast({ title: 'Audio split successfully', description: `Created ${result.segments?.length || 1} segments.` });
      } else {
        // Automatic splitting - simulate for now
        setTimeout(() => {
          setIsProcessed(true);
          setIsProcessing(false);
        }, 3000);
      }
    } catch (error) {
      console.error('Split error:', error);
      toast({ title: 'Split failed', description: error.message || 'Failed to split audio', variant: 'destructive' as any });
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Check if audio is ready
      console.log('Audio readyState:', audio.readyState);
      console.log('Audio src:', audio.src);
      console.log('Audio networkState:', audio.networkState);
      
      if (audio.readyState < 2) {
        console.log('Audio not ready, readyState:', audio.readyState);
        // Try to force load more data
        audio.load();
        // Wait a bit and try again
        setTimeout(() => {
          console.log('After load(), readyState:', audio.readyState);
          if (audio.readyState >= 2) {
            audio.play().then(() => setIsPlaying(true)).catch(console.error);
          } else {
            toast({ title: 'Audio not ready', description: `ReadyState: ${audio.readyState}. Please wait for the audio to load completely.`, variant: 'destructive' as any });
          }
        }, 1000);
        return;
      }
      
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (e) {
        console.error('Audio play failed:', e);
        setIsPlaying(false);
        toast({ title: 'Playback failed', description: 'Please try clicking the play button again.', variant: 'destructive' as any });
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const newTime = ratio * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolume = (value: number) => {
    const clamped = Math.min(Math.max(value, 0), 1);
    setVolume(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const addSplitPoint = () => {
    if (currentTime > 0 && currentTime < duration && !splitPoints.includes(currentTime)) {
      setSplitPoints([...splitPoints, currentTime].sort((a, b) => a - b));
    }
  };

  const removeSplitPoint = (index: number) => {
    setSplitPoints(splitPoints.filter((_, i) => i !== index));
  };

  const clearSplitPoints = () => {
    setSplitPoints([]);
  };


  return (
    <div id="audio-processor" className="bg-gray-900 py-20">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Process Your Audio
          </h2>

          {/* URL Input Section */}
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-8">
              <div className="flex items-center justify-center gap-4 mb-6">
                {[
                  {
                    name: 'YouTube',
                    svg: (
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                        <path d="M23.498 6.186a3.005 3.005 0 0 0-2.116-2.128C19.524 3.5 12 3.5 12 3.5s-7.524 0-9.382.558A3.005 3.005 0 0 0 .502 6.186C0 8.053 0 12 0 12s0 3.947.502 5.814a3.005 3.005 0 0 0 2.116 2.128C4.476 20.5 12 20.5 12 20.5s7.524 0 9.382-.558a3.005 3.005 0 0 0 2.116-2.128C24 15.947 24 12 24 12s0-3.947-.502-5.814ZM9.75 15.5v-7l6 3.5-6 3.5Z"/>
                      </svg>
                    ),
                  },
                  {
                    name: 'YouTube Music',
                    svg: (
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                        <path d="M12 1.75C6.071 1.75 1.25 6.571 1.25 12.5S6.071 23.25 12 23.25 22.75 18.429 22.75 12.5 17.929 1.75 12 1.75Zm0 18.5a7.75 7.75 0 1 1 0-15.5 7.75 7.75 0 0 1 0 15.5Zm-3-3.25v-9l8 4.5-8 4.5Z"/>
                      </svg>
                    ),
                  },
                  {
                    name: 'SoundCloud',
                    svg: (
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                        <path d="M18.5 10.25a3.75 3.75 0 0 1 0 7.5H6.75a2.75 2.75 0 0 1-.408-5.47A3.75 3.75 0 0 1 9.75 7.5a3.7 3.7 0 0 1 2.76 1.23 4.75 4.75 0 0 1 6-.48 3.74 3.74 0 0 1-.01 2.0Z"/>
                      </svg>
                    ),
                  },
                ].map(({ name, svg }) => (
                  <Tooltip key={name}>
                    <TooltipTrigger asChild>
                      <div
                        className={`group inline-flex items-center justify-center rounded-full h-10 w-10 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-200 text-white/80 hover:text-white hover:-translate-y-0.5 ${showPulse ? 'animate-pulse' : ''}`}
                        aria-label={name}
                        title={name}
                      >
                        {svg}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-700">
                      {name}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <Input
                placeholder="Paste Audio URL"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && audioUrl.trim()) {
                    // Trigger URL processing by clearing and setting the same URL
                    const currentUrl = audioUrl;
                    setAudioUrl('');
                    setTimeout(() => setAudioUrl(currentUrl), 10);
                  }
                }}
                className="w-full bg-gray-700 border-gray-600 text-white"
              />
              <p className="mt-2 text-xs text-gray-400">
                Note: Use a direct audio URL (e.g., .mp3, .wav). Streaming pages like SoundCloud or YouTube require a downloader proxy.
              </p>
              
              {/* Track Preparation Progress */}
              {isResolving && (
                <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                      <span className="text-sm text-gray-300">Fetching track...</span>
                    </div>
                    <span className="text-sm text-gray-400">{Math.round(resolveProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${resolveProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Job Processing Progress - HIDDEN in Audio Preview */}
              {false && currentJobId && jobStatus && (
                <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {jobStatus === 'processing' ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                      ) : jobStatus === 'completed' ? (
                        <div className="rounded-full h-4 w-4 bg-green-500"></div>
                      ) : jobStatus === 'error' ? (
                        <div className="rounded-full h-4 w-4 bg-red-500"></div>
                      ) : (
                        <div className="animate-pulse rounded-full h-4 w-4 bg-yellow-500"></div>
                      )}
                      <span className="text-sm text-gray-300">
                        {jobStatus === 'processing' ? 'Processing audio...' : 
                         jobStatus === 'completed' ? 'Processing complete!' :
                         jobStatus === 'error' ? 'Processing failed' :
                         'Queued for processing'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-400">{Math.round(jobProgress)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ease-out ${
                        jobStatus === 'completed' ? 'bg-green-500' :
                        jobStatus === 'error' ? 'bg-red-500' :
                        'bg-gradient-to-r from-green-500 to-blue-600'
                      }`}
                      style={{ width: `${jobProgress}%` }}
                    ></div>
                  </div>
                  {jobMessage && (
                    <div className="mt-2 text-xs text-gray-400">
                      {jobMessage}
                    </div>
                  )}
                  {lowResPeaks && (
                    <div className="mt-2 text-xs text-green-400">
                      ✓ Low-res waveform ready ({lowResPeaks.points} points)
                    </div>
                  )}
                </div>
              )}
              {/* Hidden audio element for real playback */}
              <audio 
                ref={audioRef} 
                className="hidden" 
                preload="auto" 
                crossOrigin="anonymous"
                src={resolvedAudioUrl ? (resolvedAudioUrl.startsWith("http://localhost:3001/stream") ? resolvedAudioUrl : `http://localhost:3001/stream?url=${encodeURIComponent(resolvedAudioUrl)}`) : undefined}
                onLoadStart={() => {
                  console.log('Audio loading started');
                  setAudioLoading(true);
                }}
                onCanPlay={() => {
                  console.log('Audio can play');
                  setAudioLoading(false);
                }}
                onError={(e) => {
                  console.error('Audio error:', e);
                  setIsPlaying(false);
                  setAudioLoading(false);
                }}
              />
            </CardContent>
          </Card>

          {/* Beautiful Preview & Download Section - Shows loading state or after audio is fetched, but hides when split mode is active */}
          {(isProcessing || audioFetched) && !splitMode && audioUrl && (
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <h2 className="text-4xl font-bold text-white text-center mb-12">
                Audio Preview
              </h2>
              
              {/* Track Metadata */}
              {audioFetched && (
                <div className="mb-8 bg-gray-700/50 rounded-lg p-6">
                  {/* Track Image and Metadata Grid */}
                  <div className="flex items-start gap-6">
                    {trackImage && (
                      <div className="flex-shrink-0">
                        <img 
                          src={trackImage} 
                          alt="Track cover" 
                          className="w-20 h-20 rounded-lg object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    {/* Compact metadata grid - optimized layout */}
                    <div className="flex-1 flex flex-wrap gap-4">
                      <div className="flex-1 min-w-0 max-w-xs">
                        <div className="text-xs text-gray-400 mb-1">Title</div>
                        <div className="text-white font-medium text-xs break-words" title={trackTitle || 'Unknown Title'}>
                          {trackTitle || 'Unknown Title'}
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0">
                        <div className="text-xs text-gray-400 mb-1">Length</div>
                        <div className="text-white font-medium text-xs">
                          {formatTime(duration)}
                        </div>
                      </div>
                      
                      <div className="flex-shrink-0">
                        <div className="text-xs text-gray-400 mb-1">Format</div>
                        <div className="text-white font-medium text-xs">
                          {audioFormat ? audioFormat.toUpperCase() : 'Unknown'}
                        </div>
                      </div>
                      
                      {audioBitrate && (
                        <div className="flex-shrink-0">
                          <div className="text-xs text-gray-400 mb-1">Quality</div>
                          <div className="text-white font-medium text-xs">
                            {audioBitrate} kbps
                          </div>
                        </div>
                      )}
                      
                      {fileSize && (
                        <div className="flex-shrink-0">
                          <div className="text-xs text-gray-400 mb-1">File Size</div>
                          <div className="text-white font-medium text-xs">
                            {fileSize}
                          </div>
                        </div>
                      )}
                      
                      {metadata?.author && (
                        <div className="flex-shrink-0">
                          <div className="text-xs text-gray-400 mb-1">Author</div>
                          <div className="text-white font-medium text-xs">
                            {metadata.author}
                          </div>
                        </div>
                      )}
                      
                      {metadata?.release_date_formatted && (
                        <div className="flex-shrink-0">
                          <div className="text-xs text-gray-400 mb-1">Release Date</div>
                          <div className="text-white font-medium text-xs">
                            {metadata.release_date_formatted}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Player Controls */}
              <div className="flex items-center justify-between mb-6 gap-4">
                <button
                  onClick={togglePlay}
                  disabled={(isProcessing && !audioFetched) || audioLoading}
                  className={`rounded-full p-4 transition-colors duration-300 ${
                    (isProcessing && !audioFetched) || audioLoading
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                  }`}
                >
                  {(isProcessing && !audioFetched) || audioLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : isPlaying ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  )}
                </button>
                
                <div className="flex-1 mx-6">
                  <div 
                    className={`rounded-full h-2 ${
                      isProcessing && !audioFetched 
                        ? 'bg-gray-600 cursor-not-allowed' 
                        : 'bg-gray-600 cursor-pointer'
                    }`} 
                    onClick={isProcessing && !audioFetched ? undefined : handleSeek}
                  >
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                
                <span className="text-gray-300 text-sm min-w-[80px] text-right">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                {/* Volume */}
                <div className="flex items-center gap-2 w-40">
                  <svg className={`w-5 h-5 ${isProcessing && !audioFetched ? 'text-gray-500' : 'text-gray-300'}`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    {/* Speaker base */}
                    <path d="M5 9v6h4l5 4V5L9 9H5z"/>
                    {/* Curvy volume level waves */}
                    {volume > 0 && (
                      <path 
                        d="M16 10c0-1.1.9-2 2-2s2 .9 2 2v4c0 1.1-.9 2-2 2s-2-.9-2-2v-4z" 
                        className="opacity-60"
                      />
                    )}
                    {volume > 0.3 && (
                      <path 
                        d="M17 8c0-1.1.9-2 2-2s2 .9 2 2v8c0 1.1-.9 2-2 2s-2-.9-2-2V8z" 
                        className="opacity-70"
                      />
                    )}
                    {volume > 0.6 && (
                      <path 
                        d="M18 6c0-1.1.9-2 2-2s2 .9 2 2v12c0 1.1-.9 2-2 2s-2-.9-2-2V6z" 
                        className="opacity-80"
                      />
                    )}
                    {volume > 0.8 && (
                      <path 
                        d="M19 4c0-1.1.9-2 2-2s2 .9 2 2v16c0 1.1-.9 2-2 2s-2-.9-2-2V4z" 
                        className="opacity-90"
                      />
                    )}
                  </svg>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => handleVolume(parseFloat(e.target.value))}
                    disabled={isProcessing && !audioFetched}
                    className={`w-full ${isProcessing && !audioFetched ? 'opacity-50 cursor-not-allowed' : 'accent-blue-500'}`}
                    aria-label="Volume"
                  />
                </div>
              </div>

              {/* Fetch New Track Button */}
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => {
                    // Stop audio first
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current.currentTime = 0;
                    }
                    
                    // Reset all states
                    setAudioUrl('');
                    setAudioFetched(false);
                    setIsProcessing(false);
                    setAudioLoading(false);
                    setTrackTitle(null);
                    setAudioFormat(null);
                    setAudioBitrate(null);
                    setFileSize(null);
                    setTrackImage(null);
                    setMetadata(null);
                    setDuration(0);
                    setCurrentTime(0);
                    setIsPlaying(false);
                    setResolvedAudioUrl(null);
                    setSplitMode(null);
                    setVolume(1);
                    setIsResolving(false);
                    setResolveProgress(0);
                  }}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  Fetch New Track
                </button>
              </div>

            </div>
          )}

          {/* Split Mode Section */}
          {audioFetched && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-center">Split Mode</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4 justify-center">
                  <Button
                    variant={splitMode === 'automatic' ? 'default' : 'outline'}
                    onClick={() => {
                      stopPlayback();
                      setSplitMode('automatic');
                    }}
                    className={`flex items-center gap-2 ${
                      splitMode === 'automatic' 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700' 
                        : ''
                    }`}
                  >
                    <Wand2 className="h-4 w-4" />
                    Automatic Split
                  </Button>
                  <Button
                    variant={splitMode === 'manual' ? 'default' : 'outline'}
                    onClick={() => {
                      stopPlayback();
                      setSplitMode('manual');
                      // Start progressive processing for Manual Split
                      if (resolvedAudioUrl || audioUrl) {
                        setAnimatedProgress(0); // Reset animation
                        startProgressiveProcessing(resolvedAudioUrl || audioUrl);
                      }
                    }}
                    className={`flex items-center gap-2 ${
                      splitMode === 'manual' 
                        ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                        : ''
                    }`}
                  >
                    <Scissors className="h-4 w-4" />
                    Manual Split
                  </Button>
                  {splitMode && (
                    <Button
                      variant="outline"
                      onClick={() => setSplitMode(null)}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Preview
                    </Button>
                  )}
                </div>

                {/* Manual Split Controls */}
                {splitMode === 'manual' && (
                  <div className="relative space-y-4">
                    <div className="text-center">
                      <p className="text-gray-300 text-sm mb-4">
                        Use yellow frame to create regions and import your selections
                      </p>
                    </div>
                    
                    
                    {/* Manual Split Waveform Editor */}
                    <div className="relative">
                      {/* Progress indication for Manual Split - hide when waveform is ready */}
                      {splitMode === 'manual' && showProgressBar && (
                        <div className="mb-4 p-4 bg-gray-800 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-medium">
                              {currentJobId ? 'Processing Audio' : 'Preparing...'}
                            </span>
                            <span className="text-blue-400 font-bold">
                              {Math.round(animatedProgress)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${animatedProgress}%` }}
                            />
                          </div>
                          <p className="text-gray-300 text-sm mt-2">
                            {currentJobId ? jobMessage.replace('progressive', '').trim() : 'Initializing waveform processing...'}
                          </p>
                        </div>
                      )}
                      
                      <Waveform
                        audioUrl={resolvedAudioUrl || audioUrl}
                        lowResPeaks={lowResPeaks}
                        useCustomPlayer={true}
                        audioRef={audioRef}
                        duration={duration}
                        onWaveformReady={() => {
                          console.log('🎯 Waveform is ready - hiding progress bar');
                          setShowProgressBar(false);
                        }}
                      />
                      
                      {/* Export controls */}
                      <div className="mt-6 bg-gray-800 rounded-lg p-4">
                        <h3 className="text-white text-lg font-semibold mb-4">Export Selection</h3>
                        <div className="flex gap-4">
                          <Button
                            onClick={async () => {
                              // Export logic here
                              console.log('Export clicked');
                            }}
                            className="bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Export Selection
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Automatic Split Controls */}
                {splitMode === 'automatic' && (
                  <div className="text-center">
                    <p className="text-gray-300 mb-4">
                      Automatic splitting will detect silence and create segments automatically
                    </p>
                    <Button
                      onClick={handleSplitAudio}
                      disabled={isProcessing}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing Audio...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          Auto Split Audio
                        </>
                      )}
                    </Button>
                  </div>
                )}

              </CardContent>
            </Card>
          )}

          {/* Results Section */}
          {isProcessed && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Split Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {splitSegments.length > 0 ? (
                    splitSegments.map((segment, index) => (
                      <div key={index} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                        <div>
                          <h4 className="text-white font-medium">Segment {segment.index}</h4>
                          <p className="text-gray-400 text-sm">
                            {formatTime(segment.startTime)} - {formatTime(segment.endTime)} 
                            ({formatTime(segment.duration)})
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = `http://localhost:3001${segment.downloadUrl}`;
                              link.download = segment.filename;
                              link.click();
                            }}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-400">No segments available. Please split the audio first.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Error Popup */}
      {showErrorPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-red-500">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-white text-lg font-semibold mb-2">
                Save Failed
              </h3>
              <p className="text-gray-300 text-sm mb-6">
                Could not save the audio segment. Please try again.
              </p>
              <Button
                onClick={() => setShowErrorPopup(false)}
                className="bg-red-600 hover:bg-red-700 px-6 py-2"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AudioProcessor;