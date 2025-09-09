import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Wand2, Scissors, Loader2 } from 'lucide-react';

const AudioProcessor: React.FC = () => {
  const [audioUrl, setAudioUrl] = useState('');
  const [audioFetched, setAudioFetched] = useState(false);
  const [splitMode, setSplitMode] = useState<'automatic' | 'manual' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);

  const handleFetchAudio = async () => {
    if (!audioUrl) return;
    setIsProcessing(true);
    // Simulate fetching
    setTimeout(() => {
      setAudioFetched(true);
      setIsProcessing(false);
    }, 2000);
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
              <div className="flex items-center justify-center gap-6 mb-6">
                <img src="https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757446774858_69d25154.webp" alt="YouTube" className="w-8 h-8" />
                <img src="https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757446777903_a0238e94.webp" alt="YouTube Music" className="w-8 h-8" />
                <img src="https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757446781013_9414200e.webp" alt="SoundCloud" className="w-8 h-8" />
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
            </CardContent>
          </Card>

          {/* Preview & Download Section */}
          {audioFetched && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Preview & Download</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Audio Waveform Placeholder */}
                <div className="bg-gray-700 rounded-lg p-8 text-center">
                  <div className="h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded opacity-50 mb-4"></div>
                  <p className="text-gray-300">Audio Waveform</p>
                </div>
                
                {/* Download Options */}
                <div className="flex gap-4 justify-center">
                  <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-700">
                    <Download className="h-4 w-4 mr-2" />
                    Download MP3
                  </Button>
                  <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-700">
                    <Download className="h-4 w-4 mr-2" />
                    Download WAV
                  </Button>
                  <Button variant="outline" className="border-gray-600 text-white hover:bg-gray-700">
                    <Download className="h-4 w-4 mr-2" />
                    Download FLAC
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Split Mode Section */}
          {audioFetched && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Split Mode</CardTitle>
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
                
                <div className="text-center">
                  <Button
                    onClick={handleSplitAudio}
                    disabled={!splitMode || isProcessing}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    {isProcessing && audioFetched ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Scissors className="h-4 w-4 mr-2" />
                        Split Audio
                      </>
                    )}
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