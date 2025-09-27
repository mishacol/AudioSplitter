import express from 'express';
import cors from 'cors';
import youtubedl from 'yt-dlp-exec';
import { Readable } from 'node:stream';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const app = express();

app.use(cors({ origin: [/^http:\/\/localhost:\d+$/] }));
app.use(express.json());

// Streaming single segment extraction (no temp files, no browser download)
const handleSingleSegmentExtraction = async (req, res, url, startTime, endTime, format) => {
  try {
    // Get direct audio URL
    let directUrl = '';
    try {
      const jsonStr = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        noPlaylist: true,
        addHeader: [
          `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`,
          `Referer: ${url}`,
        ],
      });
      const info = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      const chosen = pickBestProgressiveAudio(info);
      if (chosen?.url) directUrl = chosen.url;
    } catch {}
    
    if (!directUrl) {
      try {
        const stdout = await youtubedl(url, {
          f: 'bestaudio',
          g: true,
          addHeader: [
            `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`,
            `Referer: ${url}`,
          ],
        });
        directUrl = String(stdout).trim().split('\n').pop() || '';
      } catch {}
    }
    
    if (!directUrl) {
      return res.status(422).json({ error: 'Unable to resolve audio URL' });
    }

    // Stream the segment directly to browser (no temp files!)
    const segmentDuration = endTime - startTime;
    const filename = `audio_selection_${startTime.toFixed(1)}_to_${endTime.toFixed(1)}.${format}`;
    
    res.setHeader('Content-Type', `audio/${format}`);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    
    // Use ffmpeg to stream segment directly
    let ffmpegArgs = [
      '-hide_banner', '-loglevel', 'error',
      '-headers', `User-Agent: Mozilla/5.0\r\nReferer: ${url}\r\n`,
      '-i', directUrl,
      '-ss', startTime.toString(),
      '-t', segmentDuration.toString(),
      '-vn'
    ];

    // Set appropriate codec and format
    if (format === 'mp3') {
      ffmpegArgs.push('-acodec', 'libmp3lame', '-b:a', '192k', '-f', 'mp3');
    } else if (format === 'wav') {
      ffmpegArgs.push('-acodec', 'pcm_s16le', '-f', 'wav');
    } else if (format === 'flac') {
      ffmpegArgs.push('-acodec', 'flac', '-f', 'flac');
    } else {
      ffmpegArgs.push('-acodec', 'copy', '-f', format);
    }

    ffmpegArgs.push('-'); // Output to stdout

    const ffmpeg = spawn(ffmpegPath, ffmpegArgs);
    
    ffmpeg.stdout.pipe(res);
    ffmpeg.stderr.on('data', () => {}); // Suppress stderr
    
    ffmpeg.on('error', (error) => {
      console.error('ffmpeg error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Audio processing failed' });
      }
    });
    
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        console.error(`ffmpeg exited with code ${code}`);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Audio processing failed' });
        }
      }
      res.end();
    });
    
  } catch (error) {
    console.error('Single segment extraction error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Audio processing failed', details: error.message });
    }
  }
};
const pickBestProgressiveAudio = (info) => {
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  console.log('Total formats available:', formats.length);
  const candidates = formats.filter((f) => {
    const hasAudio = f.acodec && f.acodec !== 'none';
    const noVideo = !f.vcodec || f.vcodec === 'none';
    const url = f.url || '';
    const protocol = (f.protocol || '').toLowerCase();
    const ext = (f.ext || '').toLowerCase();
    const isSegmented = protocol.includes('m3u8') || protocol.includes('dash') || url.includes('.m3u8') || url.includes('manifest');
    const isProgressive = !isSegmented && (protocol.startsWith('http') || protocol === 'https');
    const isHLS = protocol.includes('m3u8') || url.includes('.m3u8');
    const isPlayableExt = ['mp3', 'm4a', 'webm', 'ogg'].includes(ext);
    // Accept both progressive downloads and HLS streams (like SoundCloud)
    const result = hasAudio && noVideo && url && (isProgressive || isHLS) && (isPlayableExt || true);
    if (result) {
      console.log('Found candidate format:', f.format_id, f.acodec, f.vcodec, f.ext, f.protocol);
    }
    return result;
  });
  console.log('Candidates found:', candidates.length);
  const sorted = candidates.sort((a, b) => (Number(b.abr || 0) - Number(a.abr || 0)));
  return sorted[0] || candidates[0];
};

const probeDurationWithFfprobe = async (url) => {
  return new Promise((resolve) => {
    const ffprobeCmd = process.env.FFPROBE_PATH || 'ffprobe';
    const child = execFile(ffprobeCmd, ['-v', 'quiet', '-print_format', 'json', '-show_format', url], { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve(0);
      try {
        const data = JSON.parse(String(stdout || '{}'));
        const d = parseFloat(data?.format?.duration);
        resolve(isFinite(d) ? d : 0);
      } catch {
        resolve(0);
      }
    });
    child.on('error', () => resolve(0));
  });
};

const estimateHlsDurationFromManifest = async (manifestUrl) => {
  try {
    const resp = await fetch(manifestUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) return 0;
    const text = await resp.text();
    // Sum #EXTINF:durations
    let total = 0;
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        const val = parseFloat(line.substring('#EXTINF:'.length).split(',')[0]);
        if (isFinite(val)) total += val;
      }
    }
    return total || 0;
  } catch {
    return 0;
  }
};

app.get('/', (_req, res) => {
  res.type('text/plain').send('Resolver up. Use POST /resolve or GET /stream?url=...');
});

app.post('/resolve', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: 'Missing url' });
    }

    // Prefer JSON parsing to select the best audio-only format
    try {
      console.log('Calling youtubedl with URL:', url);
      const referer = url;
      const jsonStr = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        noPlaylist: true,
        addHeader: [
          `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`,
          `Referer: ${referer}`,
        ],
      });
      console.log('youtubedl returned:', typeof jsonStr, jsonStr ? 'data received' : 'no data');
      const info = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      console.log('yt-dlp info parsed successfully, formats count:', info?.formats?.length || 0);
      const chosen = pickBestProgressiveAudio(info);
      console.log('pickBestProgressiveAudio result:', chosen);
      console.log('Available metadata:', {
        title: info?.title,
        duration: info?.duration,
        thumbnail: info?.thumbnail,
        format: chosen?.ext,
        bitrate: chosen?.abr
      });
      if (chosen?.url) {
        let durationVal = info?.duration || null;
        if (!durationVal) {
          try {
            durationVal = await probeDurationWithFfprobe(chosen.url);
          } catch {}
        }
        // Calculate file size estimate based on duration and bitrate
        let fileSizeEstimate = null;
        if (durationVal && chosen.abr) {
          // Rough estimate: bitrate (kbps) * duration (seconds) / 8 (bits to bytes) / 1024 (KB to MB)
          const sizeInMB = (parseFloat(chosen.abr) * durationVal) / (8 * 1024);
          fileSizeEstimate = sizeInMB > 1 ? `${sizeInMB.toFixed(1)} MB` : `${(sizeInMB * 1024).toFixed(0)} KB`;
        }
        
        return res.json({ 
          url: chosen.url, 
          duration: durationVal || null, 
          title: info?.title || null, 
          is_progressive: true,
          format: chosen.ext || null,
          bitrate: chosen.abr || null,
          fileSize: fileSizeEstimate,
          thumbnail: info?.thumbnail || info?.thumbnails?.[0]?.url || null
        });
      }
      // Return duration even if we couldn't choose a progressive URL
      let durationOnly = info?.duration || 0;
      if (!durationOnly) {
        // Try to find an HLS format and estimate from manifest
        const formats = Array.isArray(info?.formats) ? info.formats : [];
        const hls = formats.find((f) => (f?.url || '').includes('.m3u8'));
        if (hls?.url) {
          durationOnly = await estimateHlsDurationFromManifest(hls.url);
        }
      }
      if (durationOnly) {
        return res.json({ 
          url: null, 
          duration: durationOnly, 
          title: info?.title || null, 
          is_progressive: false,
          format: null,
          bitrate: null,
          fileSize: null
        });
      }
    } catch (e) {
      console.error('youtubedl JSON parsing failed:', e.message);
      // fall through to -g method
    }

    // Fallback to -g (direct URL to bestaudio)
    try {
      const referer = url;
      const stdout = await youtubedl(url, {
        f: 'bestaudio',
        g: true,
        addHeader: [
          `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`,
          `Referer: ${referer}`,
        ],
      });
      const directUrl = String(stdout).trim().split('\n').pop();
      if (directUrl) {
        const looksSegmented = /m3u8|mpd|dash|manifest/i.test(directUrl);
        if (looksSegmented) {
          // Estimate duration from HLS manifest if possible
          const est = await estimateHlsDurationFromManifest(directUrl);
          return res.json({ 
            url: directUrl, 
            duration: est || null, 
            title: null, 
            is_progressive: false,
            format: null,
            bitrate: null,
            fileSize: null
          });
        }
        // Progressive: try to probe duration
        const probed = await probeDurationWithFfprobe(directUrl);
        return res.json({ 
          url: directUrl, 
          duration: probed || null, 
          title: null, 
          is_progressive: true,
          format: null,
          bitrate: null,
          fileSize: null
        });
      }
    } catch (e) {
      // ignore, handled below
    }

    return res.status(422).json({ error: 'Unable to resolve media URL' });
  } catch (err) {
    console.error('resolve error', err);
    return res.status(500).json({ error: 'Resolver failed' });
  }
});

// Streaming proxy fallback: transcode best audio to mp3 and pipe
app.get('/stream', async (req, res) => {
  console.log('🎵 STREAM REQUEST:', {
    query: req.query,
    headers: req.headers,
    method: req.method,
    url: req.url
  });
  
  const sourceUrl = typeof req.query.url === 'string' && req.query.url
    ? req.query.url
    : (typeof req.query.u === 'string' ? req.query.u : '');
    
  console.log('🎵 PARSED SOURCE URL:', sourceUrl);
  
  if (typeof sourceUrl !== 'string' || !sourceUrl) {
    console.log('❌ MISSING URL - returning 400');
    return res.status(400).json({ error: 'Missing url' });
  }
  
  try {
    // Handle YouTube URLs FIRST by redirecting to Python backend
    if (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be')) {
      console.log('🎵 YOUTUBE URL DETECTED - calling Python backend:', sourceUrl);
      
      try {
        console.log('🎵 CALLING PYTHON BACKEND:', 'http://localhost:5000/metadata');
        console.log('🎵 REQUEST BODY:', JSON.stringify({ url: sourceUrl }));
        
        // Get the direct audio URL from Python backend
        const pythonResponse = await fetch('http://localhost:5000/metadata', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: sourceUrl })
        });
        
        console.log('🎵 PYTHON RESPONSE STATUS:', pythonResponse.status);
        console.log('🎵 PYTHON RESPONSE OK:', pythonResponse.ok);
        
        if (!pythonResponse.ok) {
          console.log('❌ PYTHON BACKEND ERROR:', pythonResponse.status);
          throw new Error(`Python backend error: ${pythonResponse.status}`);
        }
        
        const metadata = await pythonResponse.json();
        console.log('🎵 PYTHON METADATA RECEIVED:', {
          hasDirectAudioUrl: !!metadata.direct_audio_url,
          directAudioUrlLength: metadata.direct_audio_url?.length || 0,
          title: metadata.title,
          duration: metadata.duration
        });
        
        if (metadata.direct_audio_url) {
          console.log('🎵 STARTING YT-DLP PROCESS for URL:', sourceUrl);
          
          // First, let's see what formats are available
          console.log('🎵 CHECKING AVAILABLE FORMATS...');
          const listFormatsProcess = spawn('yt-dlp', [
            '--no-warnings',
            '--no-check-certificates',
            '--extractor-args', 'youtube:player_client=android',
            '--list-formats',
            sourceUrl
          ], {
            stdio: ['ignore', 'pipe', 'pipe']
          });
          
          let formatsOutput = '';
          listFormatsProcess.stdout.on('data', (data) => {
            formatsOutput += data.toString();
          });
          
          listFormatsProcess.on('close', (code) => {
            console.log('🎵 AVAILABLE FORMATS:');
            console.log(formatsOutput);
            
            // Check if we have audio-only formats, otherwise use video format with audio extraction
            let selectedFormat = 'bestaudio';
            if (formatsOutput.includes('mp4a.40.2') && !formatsOutput.includes('audio only')) {
              // No pure audio formats, use video format and extract audio only
              selectedFormat = '18';
              console.log('🎵 NO PURE AUDIO FORMATS - using video format 18 and extracting audio only');
            } else {
              console.log('🎵 USING PURE AUDIO FORMAT');
            }
            
            console.log('🎵 STARTING DOWNLOAD with format:', selectedFormat);
            
            // Build command arguments
            const ytdlpArgs = [
              '--no-warnings',
              '--no-check-certificates',
              '--prefer-free-formats',
              '--no-playlist',
              '--format', selectedFormat,
              '--extractor-args', 'youtube:player_client=android',
              '--add-header', `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`,
              '--add-header', `Referer: ${sourceUrl}`,
              '--output', '-',
              sourceUrl
            ];
            
            console.log('🎵 FINAL YT-DLP COMMAND:', ytdlpArgs);
            
            // If using video format, pipe through ffmpeg to extract audio
            if (selectedFormat === '18') {
              console.log('🎵 USING FFMPEG TO EXTRACT AUDIO FROM VIDEO');
              
              // First get the video stream with yt-dlp
              const ytdlpProcess = spawn('yt-dlp', ytdlpArgs, {
                stdio: ['ignore', 'pipe', 'pipe']
              });
              
              // Then pipe through ffmpeg to extract audio
              const ffmpegProcess = spawn('ffmpeg', [
                '-i', 'pipe:0',  // Input from stdin (yt-dlp output)
                '-vn',           // No video
                '-acodec', 'libmp3lame',  // MP3 audio codec
                '-ab', '128k',   // Audio bitrate
                '-f', 'mp3',     // Output format
                'pipe:1'         // Output to stdout
              ], {
                stdio: ['pipe', 'pipe', 'pipe']
              });
              
              // Connect yt-dlp output to ffmpeg input
              ytdlpProcess.stdout.pipe(ffmpegProcess.stdin);
              
              // Use ffmpeg output for streaming
              const audioProcess = ffmpegProcess;
              
              console.log('🎵 YT-DLP PROCESS STARTED with PID:', ytdlpProcess.pid);
              console.log('🎵 FFMPEG PROCESS STARTED with PID:', ffmpegProcess.pid);
              
            } else {
              // Pure audio format, use yt-dlp directly
              const audioProcess = spawn('yt-dlp', ytdlpArgs, {
                stdio: ['ignore', 'pipe', 'pipe']
              });
              
              console.log('🎵 YT-DLP PROCESS STARTED with PID:', audioProcess.pid);
            }
            
            // Set headers for audio streaming
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Timing-Allow-Origin', '*');
            res.setHeader('Content-Disposition', 'inline; filename="stream.mp3"');
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

            // Handle audio process with proper error handling
            let hasData = false;
            let timeoutId;

            // Set a timeout to detect if no data is received
            timeoutId = setTimeout(() => {
              if (!hasData && !res.headersSent) {
                console.error('🎵 AUDIO STREAMING TIMEOUT - no data received');
                audioProcess.kill();
                res.status(500).json({ error: 'Audio streaming timeout' });
              }
            }, 20000); // 20 second timeout (longer for ffmpeg processing)

            audioProcess.stdout.on('data', (data) => {
              console.log('🎵 AUDIO STREAM DATA:', data.length, 'bytes');
              hasData = true;
              clearTimeout(timeoutId);
              if (!res.headersSent) {
                console.log('🎵 SENDING 200 STATUS');
                res.status(200);
              }
              res.write(data);
            });

            audioProcess.stdout.on('end', () => {
              console.log('🎵 AUDIO STREAM ENDED');
              clearTimeout(timeoutId);
              if (!res.headersSent) {
                console.log('🎵 SENDING 200 STATUS (end)');
                res.status(200);
              }
              res.end();
            });
            
            audioProcess.stderr.on('data', (data) => {
              console.error('🎵 AUDIO PROCESS STDERR:', data.toString());
            });

            audioProcess.on('error', (error) => {
              console.error('🎵 AUDIO PROCESS ERROR:', error);
              clearTimeout(timeoutId);
              if (!res.headersSent) {
                res.status(500).json({ error: 'Audio streaming failed' });
              }
            });

            audioProcess.on('close', (code) => {
              console.log('🎵 AUDIO PROCESS CLOSED with code:', code);
              clearTimeout(timeoutId);
              if (code !== 0) {
                console.error('🎵 AUDIO PROCESS FAILED with code:', code);
                if (!res.headersSent) {
                  res.status(500).json({ error: 'Audio streaming failed' });
                }
              } else if (!hasData) {
                console.error('🎵 AUDIO PROCESS COMPLETED BUT NO DATA RECEIVED');
                if (!res.headersSent) {
                  res.status(500).json({ error: 'No audio data received' });
                }
              } else {
                console.log('🎵 AUDIO PROCESS COMPLETED SUCCESSFULLY');
              }
            });

            // Handle client disconnect
            req.on('close', () => {
              clearTimeout(timeoutId);
              audioProcess.kill();
            });
          });
          
          listFormatsProcess.stderr.on('data', (data) => {
            console.error('🎵 LIST-FORMATS STDERR:', data.toString());
          });
          
          listFormatsProcess.on('error', (error) => {
            console.error('🎵 LIST-FORMATS ERROR:', error);
            // If listing formats fails, try direct download anyway
            console.log('🎵 FALLBACK: Starting download without format check');
            // ... (fallback code would go here)
          });

          return; // Exit early since we handled the YouTube URL
        } else {
          console.log('❌ NO DIRECT AUDIO URL FROM PYTHON BACKEND');
          throw new Error('No direct audio URL from Python backend');
        }
      } catch (error) {
        console.error('❌ PYTHON BACKEND STREAMING FAILED:', error.message);
        console.error('❌ ERROR STACK:', error.stack);
        res.status(500).json({ error: 'Unable to resolve media URL' });
        return;
      }
    }

    // Check if this is already a direct media URL (from /resolve endpoint)
    const isDirectUrl = sourceUrl.includes('soundcloud.com') || 
                       sourceUrl.includes('.mp3') || 
                       sourceUrl.includes('.m4a') ||
                       sourceUrl.includes('.webm') ||
                       sourceUrl.includes('m3u8');
    
    let directUrl = '';
    if (isDirectUrl) {
      // This is already a direct URL, use it directly
      console.log('Using direct URL:', sourceUrl);
      directUrl = sourceUrl;
    } else {
      // Resolve to a direct audio URL first
      try {
        const jsonStr = await youtubedl(sourceUrl, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        noPlaylist: true,
        f: 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio[ext=webm]/bestaudio',
        extractorArgs: 'youtube:player_client=android',
        addHeader: [
          `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`,
          `Referer: ${sourceUrl}`,
        ],
      });
      const info = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      console.log('yt-dlp info received:', {
        title: info.title,
        formats: info.formats?.length || 0,
        duration: info.duration
      });
        const chosen = pickBestProgressiveAudio(info);
        console.log('Chosen format:', chosen);
        if (chosen?.url) directUrl = chosen.url;
      } catch (err) {
        console.error('yt-dlp JSON parsing failed:', err.message);
      }
    }
    if (!directUrl) {
      try {
        const stdout = await youtubedl(sourceUrl, {
          f: 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio[ext=webm]/bestaudio',
          g: true,
          extractorArgs: 'youtube:player_client=android',
          addHeader: [
            `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`,
            `Referer: ${sourceUrl}`,
          ],
        });
        directUrl = String(stdout).trim().split('\n').pop() || '';
      } catch (err) {
        console.error('yt-dlp stdout parsing failed:', err.message);
      }
    }
    if (!directUrl) {
      return res.status(422).json({ error: 'Unable to resolve media URL' });
    }

    // If segmented (HLS/DASH), transcode to progressive MP3 via ffmpeg
    const looksSegmented = /m3u8|manifest|dash|\.mpd/.test(directUrl);
    if (looksSegmented && ffmpegPath) {
      res.status(200);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Timing-Allow-Origin', '*');
      res.setHeader('Content-Disposition', 'inline; filename="stream.mp3"');
      const ff = spawn(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error',
        '-headers', `User-Agent: Mozilla/5.0\r\nReferer: ${sourceUrl}\r\n`,
        '-i', directUrl,
        '-vn', '-acodec', 'libmp3lame', '-b:a', '192k',
        '-f', 'mp3', '-'
      ]);
      ff.stdout.pipe(res);
      ff.stderr.on('data', () => {});
      ff.on('error', () => { if (!res.headersSent) res.status(500); res.end(); });
      ff.on('close', () => res.end());
      return;
    }

    // Proxy the direct URL and forward Range header for seeking (non-YouTube URLs)
    const range = req.headers['range'];
    const upstream = await fetch(directUrl, {
      method: 'GET',
      headers: {
        ...(range ? { Range: range } : {}),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': sourceUrl,
      },
    });

    // Forward critical headers but prefer inline playback
    res.status(upstream.status);
    let contentType = upstream.headers.get('content-type');
    const contentLength = upstream.headers.get('content-length');
    const acceptRanges = upstream.headers.get('accept-ranges');
    const contentRange = upstream.headers.get('content-range');
    let contentDisposition = upstream.headers.get('content-disposition') || '';

    // Force an audio content-type for inline playback if upstream is generic
    if (!contentType || !/^audio\//i.test(contentType)) {
      contentType = 'audio/mpeg';
    }
    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    res.setHeader('Cache-Control', upstream.headers.get('cache-control') || 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Timing-Allow-Origin', '*');
    // Force inline playback to avoid browser download prompts
    // Always prefer inline; some sources force attachment
    const ext = (contentType && contentType.includes('mp4')) ? 'm4a' : (contentType && contentType.includes('ogg') ? 'ogg' : 'mp3');
    contentDisposition = `inline; filename="stream.${ext}"`;
    res.setHeader('Content-Disposition', contentDisposition);
    // Ensure range support header exists for seeking
    if (!acceptRanges) res.setHeader('Accept-Ranges', 'bytes');
    // Help Chrome treat this as cross-origin media resource
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (upstream.body) {
      try {
        const nodeStream = Readable.fromWeb(upstream.body);
        nodeStream.on('error', () => {
          if (!res.headersSent) res.status(500);
          res.end();
        });
        nodeStream.pipe(res);
      } catch {
        // Fallback for older Node versions
        // @ts-ignore
        const anyBody = upstream.body;
        if (typeof anyBody?.pipe === 'function') {
          anyBody.pipe(res);
        } else {
          const buf = Buffer.from(await upstream.arrayBuffer());
          res.end(buf);
        }
      }
    } else {
      res.end();
    }
  } catch (e) {
    return res.status(500).json({ error: 'Stream failed' });
  }
});

// Manual audio splitting endpoint - streaming approach
app.post('/split', async (req, res) => {
  try {
    const { url, splitPoints, format = 'mp3', startTime: customStartTime, endTime: customEndTime } = req.body || {};
    
    console.log('Split request:', { url, splitPoints, format, customStartTime, customEndTime });
    
    // Handle single segment extraction (manual split mode)
    if (customStartTime !== undefined && customEndTime !== undefined) {
      return await handleSingleSegmentExtraction(req, res, url, customStartTime, customEndTime, format);
    }
    
    if (!url || !Array.isArray(splitPoints) || splitPoints.length === 0) {
      return res.status(400).json({ error: 'Missing url or splitPoints array' });
    }

    // Validate split points (should be numbers between 0 and duration)
    const validSplitPoints = splitPoints.filter(point => 
      typeof point === 'number' && point >= 0 && isFinite(point)
    ).sort((a, b) => a - b);

    if (validSplitPoints.length === 0) {
      return res.status(400).json({ error: 'No valid split points provided' });
    }

    // Get audio info first to validate duration
    let audioInfo;
    try {
      const jsonStr = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        noPlaylist: true,
        addHeader: [
          `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`,
          `Referer: ${url}`,
        ],
      });
      audioInfo = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    } catch (e) {
      return res.status(422).json({ error: 'Unable to resolve audio URL' });
    }

    const duration = audioInfo?.duration || 0;
    if (duration === 0) {
      return res.status(422).json({ error: 'Unable to determine audio duration' });
    }

    // Filter out split points beyond duration
    const finalSplitPoints = validSplitPoints.filter(point => point < duration);
    if (finalSplitPoints.length === 0) {
      return res.status(400).json({ error: 'All split points are beyond audio duration' });
    }

    // Get the best audio URL
    const chosen = pickBestProgressiveAudio(audioInfo);
    if (!chosen?.url) {
      return res.status(422).json({ error: 'Unable to get audio URL for splitting' });
    }

    const audioUrl = chosen.url;
    const segments = [];
    const tempFiles = [];

    try {
      // Create segments based on split points
      for (let i = 0; i < finalSplitPoints.length + 1; i++) {
        const startTime = customStartTime !== undefined ? customStartTime : (i === 0 ? 0 : finalSplitPoints[i - 1]);
        const endTime = i === finalSplitPoints.length ? duration : finalSplitPoints[i];
        
        if (startTime >= endTime) continue; // Skip invalid segments

        const segmentDuration = endTime - startTime;
        const tempFile = join(tmpdir(), `segment_${Date.now()}_${i}.${format}`);
        tempFiles.push(tempFile);

        // Use ffmpeg to extract segment
        await new Promise((resolve, reject) => {
          let ffmpegArgs = [
            '-hide_banner', '-loglevel', 'error',
            '-headers', `User-Agent: Mozilla/5.0\r\nReferer: ${url}\r\n`,
            '-i', audioUrl,
            '-ss', startTime.toString(),
            '-t', segmentDuration.toString(),
            '-vn'
          ];

          // Set appropriate codec and format based on output format
          if (format === 'mp3') {
            ffmpegArgs.push('-acodec', 'libmp3lame', '-b:a', '192k', '-f', 'mp3');
          } else if (format === 'wav') {
            ffmpegArgs.push('-acodec', 'pcm_s16le', '-f', 'wav');
          } else if (format === 'flac') {
            ffmpegArgs.push('-acodec', 'flac', '-f', 'flac');
          } else {
            ffmpegArgs.push('-acodec', 'copy', '-f', format);
          }

          ffmpegArgs.push(tempFile);

          const ffmpeg = spawn(ffmpegPath, ffmpegArgs);

          ffmpeg.on('close', (code) => {
            if (code === 0) {
              resolve();
            } else {
              console.error(`ffmpeg exited with code ${code}`);
              reject(new Error(`ffmpeg exited with code ${code}`));
            }
          });

          ffmpeg.on('error', (error) => {
            console.error('ffmpeg error:', error);
            reject(error);
          });
        });

        segments.push({
          index: i + 1,
          startTime,
          endTime,
          duration: segmentDuration,
          filename: `segment_${i + 1}.${format}`,
          tempPath: tempFile
        });
      }

      // Send segments as zip or individual files
      if (segments.length === 1) {
        // Single segment - send directly
        const segment = segments[0];
        res.setHeader('Content-Type', `audio/${format}`);
        res.setHeader('Content-Disposition', `attachment; filename="${segment.filename}"`);
        res.sendFile(segment.tempPath, (err) => {
          if (err) console.error('Error sending file:', err);
          // Clean up temp file
          try { unlinkSync(segment.tempPath); } catch {}
        });
      } else {
        // Multiple segments - return metadata for frontend to download individually
        res.json({
          success: true,
          segments: segments.map(seg => ({
            index: seg.index,
            startTime: seg.startTime,
            endTime: seg.endTime,
            duration: seg.duration,
            filename: seg.filename,
            downloadUrl: `/download-segment/${Buffer.from(seg.tempPath).toString('base64')}`
          }))
        });
      }

    } catch (error) {
      // Clean up temp files on error
      tempFiles.forEach(file => {
        try { unlinkSync(file); } catch {}
      });
      throw error;
    }

  } catch (err) {
    console.error('Split error:', err);
    return res.status(500).json({ error: 'Audio splitting failed', details: err.message });
  }
});

// Download individual segment endpoint
app.get('/download-segment/:encodedPath', (req, res) => {
  try {
    const encodedPath = req.params.encodedPath;
    const tempPath = Buffer.from(encodedPath, 'base64').toString();
    
    res.download(tempPath, (err) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'File not found' });
        }
      }
      // Clean up temp file after download
      try { unlinkSync(tempPath); } catch {}
    });
  } catch (err) {
    console.error('Download segment error:', err);
    res.status(500).json({ error: 'Download failed' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Resolver server listening on http://localhost:${port}`);
});


