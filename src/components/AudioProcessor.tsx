import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Wand2, Scissors, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/use-toast';

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [hasTriedStreamFallback, setHasTriedStreamFallback] = useState(false);
  const [volume, setVolume] = useState(1);

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

  const resolveStreamingUrl = async (url: string): Promise<{ url: string | null; duration?: number | null; is_progressive?: boolean | null; title?: string | null } | null> => {
    try {
      const response = await fetch('http://localhost:3001/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (typeof data?.url === 'string' || typeof data?.duration === 'number') {
        return { url: data?.url ?? null, duration: data?.duration, is_progressive: data?.is_progressive ?? null, title: data?.title ?? null };
      }
      return null;
    } catch {
      return null;
    }
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
          const streamUrl = `http://localhost:3001/stream?url=${encodeURIComponent(audioUrl)}`;
          audio.src = streamUrl;
          audio.load();
          // Defer playback to a user gesture to avoid autoplay restrictions
          setIsPlaying(false);
          setAudioFetched(true);
          return;
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

  const handleFetchAudio = async () => {
    if (!audioUrl) return;
    setIsProcessing(true);
    setAudioFetched(false);
    setHasTriedStreamFallback(false);
    try {
      let loadUrl = audioUrl;
      if (isStreamingPlatformUrl(audioUrl)) {
        // Immediately route playback through our proxy to avoid CORS, and fetch metadata in background
        loadUrl = `http://localhost:3001/stream?url=${encodeURIComponent(audioUrl)}`;
        setHasTriedStreamFallback(true);
      setAudioFetched(true);
        // Fire and forget duration resolve; do not flip UI back if it fails
        resolveStreamingUrl(audioUrl).then((resolved) => {
          if (resolved?.duration && resolved.duration > 0) {
            setDuration(resolved.duration);
          }
        }).catch(() => {});
      }
      const audio = audioRef.current;
      if (!audio) return;
      audio.src = loadUrl;
      audio.load();
      // Let events drive the rest (loadedmetadata/canplay)
    } catch (e) {
      setIsProcessing(false);
      toast({ title: 'Invalid URL', description: 'Please provide a direct audio URL (mp3, wav, etc.) or use a supported source.', variant: 'destructive' as any });
    }
  };

  const handleSplitAudio = async () => {
    if (!splitMode) return;
    setIsProcessing(true);
    // Simulate processing
    setTimeout(() => {
      setIsProcessed(true);
      setIsProcessing(false);
    }, 3000);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (e) {
        toast({ title: 'Playback failed', description: 'Autoplay restrictions or load errors may prevent playback.', variant: 'destructive' as any });
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
              <div className="flex gap-4">
                <Input
                  placeholder="Paste Audio URL"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white flex-1"
                />
                <Button 
                  onClick={handleFetchAudio}
                  disabled={!audioUrl || isProcessing}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  {isProcessing && !audioFetched ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Fetching...
                    </>
                  ) : (
                    'Fetch Audio'
                  )}
                </Button>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Note: Use a direct audio URL (e.g., .mp3, .wav). Streaming pages like SoundCloud or YouTube require a downloader proxy.
              </p>
              {/* Hidden audio element for real playback */}
              <audio ref={audioRef} className="hidden" preload="auto" />
            </CardContent>
          </Card>

          {/* Beautiful Preview & Download Section - Only shows after audio is fetched */}
          {audioFetched && (
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700">
              <h2 className="text-4xl font-bold text-white text-center mb-12">
                Audio Preview
              </h2>
              
              {/* Waveform Visualization */}
              <div className="mb-8">
                <div className="h-32 bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                  <img
                    src="https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360817366_a5a1c9ff.webp"
                    alt="Audio waveform"
                    className="w-full h-full object-cover rounded-lg opacity-60"
                  />
                </div>
              </div>

              {/* Player Controls */}
              <div className="flex items-center justify-between mb-6 gap-4">
                <button
                  onClick={togglePlay}
                  className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 transition-colors duration-300"
                >
                  {isPlaying ? (
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
                  <div className="bg-gray-600 rounded-full h-2 cursor-pointer" onClick={handleSeek}>
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
                  <svg className="w-5 h-5 text-gray-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M5 9v6h4l5 4V5L9 9H5z"/>
                  </svg>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(e) => handleVolume(parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                    aria-label="Volume"
                  />
                </div>
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
                    onClick={() => setSplitMode('automatic')}
                    className="flex items-center gap-2"
                  >
                    <Wand2 className="h-4 w-4" />
                    Automatic Split
                  </Button>
                  <Button
                    variant={splitMode === 'manual' ? 'default' : 'outline'}
                    onClick={() => setSplitMode('manual')}
                    className="flex items-center gap-2"
                  >
                    <Scissors className="h-4 w-4" />
                    Manual Split
                  </Button>
                </div>
                

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
                  {['Track 1', 'Track 2', 'Track 3'].map((track, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                      <div>
                        <h4 className="text-white font-medium">{track}</h4>
                        <p className="text-gray-400 text-sm">Duration: {30 + index * 15}s</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-1" />
                          MP3
                        </Button>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-1" />
                          WAV
                        </Button>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-1" />
                          FLAC
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioProcessor;