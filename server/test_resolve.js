import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Copy the pickBestProgressiveAudio function
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

async function testResolve() {
  try {
    console.log('Testing yt-dlp with YouTube URL...');
    
    // Test yt-dlp directly
    const { stdout } = await execAsync('yt-dlp --dump-json "https://www.youtube.com/watch?v=16TTpQVhmPE"');
    const info = JSON.parse(stdout);
    
    console.log('yt-dlp info parsed successfully, formats count:', info?.formats?.length || 0);
    
    // Test our function
    const chosen = pickBestProgressiveAudio(info);
    console.log('pickBestProgressiveAudio result:', chosen);
    
    if (chosen?.url) {
      console.log('SUCCESS: Found audio URL:', chosen.url);
    } else {
      console.log('FAILED: No audio URL found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testResolve();
