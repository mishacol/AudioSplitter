#!/usr/bin/env python3
"""
Audio processing backend using Python libraries for clean waveform generation
and precise audio splitting.
"""

import os
import sys
import json
import librosa
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.backends.backend_agg import FigureCanvasAgg
import io
import base64
from pydub import AudioSegment
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import tempfile
import uuid
import yt_dlp

app = Flask(__name__)
CORS(app)

# Add request logging middleware
@app.before_request
def log_request_info():
    print(f"🎵 PYTHON BACKEND: Incoming request: {request.method} {request.path}")
    if request.method == 'POST' and request.is_json:
        data = request.get_json()
        if 'url' in data:
            print(f"🎵 PYTHON BACKEND: Request URL: {data['url']}")

class AudioProcessor:
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
        
    def download_audio(self, url):
        """Download audio from URL using yt-dlp"""
        try:
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': os.path.join(self.temp_dir, '%(title)s.%(ext)s'),
                'extractaudio': True,
                'audioformat': 'mp3',
                'noplaylist': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                # Convert to mp3 if needed
                if not filename.endswith('.mp3'):
                    audio = AudioSegment.from_file(filename)
                    mp3_filename = filename.rsplit('.', 1)[0] + '.mp3'
                    audio.export(mp3_filename, format='mp3')
                    os.remove(filename)  # Remove original file
                    filename = mp3_filename
                
                return filename, info.get('duration', 0)
                
        except Exception as e:
            print(f"Download error: {e}")
            return None, 0
        
    def generate_waveform_data(self, audio_file_path):
        """Generate clean waveform data for visualization"""
        try:
            # Load audio file
            y, sr = librosa.load(audio_file_path, sr=None)
            duration = len(y) / sr
            
            # Generate waveform data
            times = np.linspace(0, duration, len(y))
            
            # Downsample for visualization (reduce data points)
            downsample_factor = max(1, len(y) // 2000)  # Max 2000 points
            y_downsampled = y[::downsample_factor]
            times_downsampled = times[::downsample_factor]
            
            return {
                'times': times_downsampled.tolist(),
                'amplitudes': y_downsampled.tolist(),
                'duration': duration,
                'sample_rate': sr,
                'original_length': len(y)
            }
        except Exception as e:
            print(f"Error generating waveform data: {e}")
            return None
    
    def create_waveform_image(self, audio_file_path, split_points=None):
        """Create a clean waveform visualization image"""
        try:
            # Load audio
            y, sr = librosa.load(audio_file_path, sr=None)
            duration = len(y) / sr
            
            # Create figure
            fig, ax = plt.subplots(figsize=(12, 4))
            fig.patch.set_facecolor('#1f2937')  # Dark background
            ax.set_facecolor('#374151')
            
            # Generate waveform
            times = np.linspace(0, duration, len(y))
            
            # Plot waveform
            ax.plot(times, y, color='#4F46E5', linewidth=0.8, alpha=0.8)
            ax.fill_between(times, y, 0, color='#4F46E5', alpha=0.3)
            
            # Add split points if provided
            if split_points:
                for i, point in enumerate(split_points):
                    if 0 <= point <= duration:
                        ax.axvline(x=point, color='#EF4444', linewidth=2, alpha=0.8)
                        ax.text(point, max(y) * 0.8, f'{i+1}', 
                               color='#EF4444', fontweight='bold', fontsize=10,
                               ha='center', va='bottom')
            
            # Styling
            ax.set_xlim(0, duration)
            ax.set_ylim(-1, 1)
            ax.set_xlabel('Time (seconds)', color='white')
            ax.set_ylabel('Amplitude', color='white')
            ax.tick_params(colors='white')
            ax.grid(True, alpha=0.3, color='white')
            
            # Remove top and right spines
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['bottom'].set_color('white')
            ax.spines['left'].set_color('white')
            
            plt.tight_layout()
            
            # Convert to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight',
                       facecolor='#1f2937', edgecolor='none')
            buffer.seek(0)
            
            # Encode as base64
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close(fig)
            
            return f"data:image/png;base64,{image_base64}"
            
        except Exception as e:
            print(f"Error creating waveform image: {e}")
            return None
    
    def split_audio(self, audio_file_path, split_points, output_format='mp3'):
        """Split audio at specified points"""
        try:
            # Load audio
            audio = AudioSegment.from_file(audio_file_path)
            duration_ms = len(audio)
            
            # Convert split points to milliseconds
            split_points_ms = [int(point * 1000) for point in split_points if 0 <= point <= duration_ms/1000]
            
            segments = []
            temp_files = []
            
            # Create segments
            start = 0
            for i, end_ms in enumerate(split_points_ms + [duration_ms]):
                if start < end_ms:
                    segment = audio[start:end_ms]
                    
                    # Save segment
                    temp_file = os.path.join(self.temp_dir, f"segment_{uuid.uuid4()}.{output_format}")
                    segment.export(temp_file, format=output_format)
                    temp_files.append(temp_file)
                    
                    segments.append({
                        'index': i + 1,
                        'start_time': start / 1000,
                        'end_time': end_ms / 1000,
                        'duration': (end_ms - start) / 1000,
                        'filename': f"segment_{i + 1}.{output_format}",
                        'temp_path': temp_file
                    })
                
                start = end_ms
            
            return segments, temp_files
            
        except Exception as e:
            print(f"Error splitting audio: {e}")
            return None, None

# Initialize processor
processor = AudioProcessor()

@app.route('/')
def home():
    return jsonify({'message': 'Python Audio Processor API'})

@app.route('/metadata', methods=['POST'])
def extract_metadata():
    """Extract metadata from URL using yt-dlp without downloading"""
    try:
        data = request.get_json()
        url = data.get('url')
        
        if not url:
            return jsonify({'error': 'No URL provided'}), 400
        
        print(f"🎵 PYTHON BACKEND: Starting metadata extraction for URL: {url}")
        print(f"🎵 PYTHON BACKEND: Request data: {data}")
        
        # Use the EXACT same options that work on main branch
        ydl_opts = {
            'quiet': False,  # Enable verbose for logs
            'no_warnings': False,
            'extract_flat': False,  # Full extraction for metadata
            'skip_download': True,
            'sleep_interval': 1,  # Avoid rate limits
            'max_sleep_interval': 5,
            # REMOVED extractor_args - use default web client like main branch
            'format': 'bestaudio[ext=m4a]/bestaudio/best',  # Prefer M4A audio
            'noplaylist': True,  # Only extract first video, not entire playlist
        }
        
        print(f"🎵 PYTHON BACKEND: yt-dlp options: {ydl_opts}")
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"🎵 PYTHON BACKEND: Starting yt-dlp extraction...")
            info = ydl.extract_info(url, download=False)
            print(f"🎵 PYTHON BACKEND: yt-dlp extraction completed")
            print(f"🎵 PYTHON BACKEND: Raw info keys: {list(info.keys()) if info else 'None'}")
            
            if info and 'formats' in info:
                print(f"🎵 PYTHON BACKEND: Total formats available: {len(info['formats'])}")
                # Use the EXACT same format selection logic as main branch
                audio_formats = [f for f in info['formats'] if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
                print(f"🎵 PYTHON BACKEND: Audio-only formats found: {len(audio_formats)}")
                for i, fmt in enumerate(audio_formats[:5]):  # Show first 5
                    print(f"🎵 PYTHON BACKEND: Format {i+1}: ID={fmt.get('format_id')}, ext={fmt.get('ext')}, abr={fmt.get('abr')}, url_length={len(fmt.get('url', ''))}")
            
            if 'entries' in info and info['entries']:
                entry = info['entries'][0]  # Take first for radio/playlist
                print(f"🎵 PYTHON BACKEND: Using entry[0]: {entry.get('title', 'No title')}")
                info = entry
            
            # Enhanced field extraction
            metadata = {
                'title': info.get('title', 'Unknown Title'),
                'album': info.get('album', info.get('playlist_title', 'Unknown Album')),
                'author': info.get('uploader', info.get('channel', info.get('artist', 'Unknown Artist'))),
                'producer': info.get('artist', info.get('uploader', info.get('channel', 'Unknown Producer'))),
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail', info.get('webpage_url', '')) or None,
                'filesize': info.get('filesize_approx', info.get('filesize', 'Unknown Size')),
                'format': info.get('ext', 'Unknown Format'),  # e.g., 'm4a'
                'url': url,
                'direct_audio_url': None,
                'bitrate': info.get('abr', 'Unknown'),
                'filesize_bytes': info.get('filesize_approx', info.get('filesize', None)),
                'release_date': info.get('upload_date', info.get('release_date', info.get('release_year', None))),
                'upload_date': info.get('upload_date', None),
                'release_year': info.get('release_year', None)
            }
            
            print(f"🎵 PYTHON BACKEND: Basic metadata extracted: title='{metadata['title']}', duration={metadata['duration']}, author='{metadata['author']}'")
            
            # Try to get direct audio URL from formats - EXACT same logic as main branch
            if 'formats' in info:
                audio_formats = [f for f in info['formats'] if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
                if audio_formats:
                    # Sort by bitrate (highest first) - EXACT same as main branch
                    best_audio = max(audio_formats, key=lambda f: f.get('abr', 0))
                    metadata['direct_audio_url'] = best_audio.get('url')
                    metadata['format'] = best_audio.get('ext', metadata['format'])
                    print(f"🎵 PYTHON BACKEND: Selected best audio format: ID={best_audio.get('format_id')}, ext={best_audio.get('ext')}, abr={best_audio.get('abr')}")
                    print(f"🎵 PYTHON BACKEND: Direct audio URL length: {len(metadata['direct_audio_url']) if metadata['direct_audio_url'] else 0}")
                else:
                    print(f"🎵 PYTHON BACKEND: No audio-only formats found, checking all formats...")
                    all_formats = info['formats']
                    for fmt in all_formats[:3]:  # Show first 3 formats
                        print(f"🎵 PYTHON BACKEND: Format: ID={fmt.get('format_id')}, acodec={fmt.get('acodec')}, vcodec={fmt.get('vcodec')}, ext={fmt.get('ext')}")
            
            # Format file size if available
            if metadata['filesize_bytes']:
                size_bytes = metadata['filesize_bytes']
                if size_bytes > 1024 * 1024:  # MB
                    metadata['filesize_formatted'] = f"{size_bytes / (1024 * 1024):.1f} MB"
                else:  # KB
                    metadata['filesize_formatted'] = f"{size_bytes / 1024:.0f} KB"
            else:
                metadata['filesize_formatted'] = 'Unknown'
            
            # Format release date if available
            if metadata['release_date']:
                try:
                    # Convert YYYYMMDD format to readable date
                    if isinstance(metadata['release_date'], str) and len(metadata['release_date']) == 8:
                        year = metadata['release_date'][:4]
                        month = metadata['release_date'][4:6]
                        day = metadata['release_date'][6:8]
                        metadata['release_date_formatted'] = f"{day}.{month}.{year}"
                    elif isinstance(metadata['release_date'], int):
                        # Handle timestamp or year
                        if metadata['release_date'] > 1900 and metadata['release_date'] < 2100:
                            metadata['release_date_formatted'] = str(metadata['release_date'])
                        else:
                            metadata['release_date_formatted'] = 'Unknown'
                    else:
                        metadata['release_date_formatted'] = str(metadata['release_date'])
                except:
                    metadata['release_date_formatted'] = 'Unknown'
            else:
                metadata['release_date_formatted'] = 'Unknown'
            
            print(f"🎵 PYTHON BACKEND: Final metadata prepared successfully")
            print(f"🎵 PYTHON BACKEND: Has direct_audio_url: {bool(metadata['direct_audio_url'])}")
            print(f"🎵 PYTHON BACKEND: Direct audio URL preview: {metadata['direct_audio_url'][:100] if metadata['direct_audio_url'] else 'None'}...")
            return jsonify(metadata)
            
    except Exception as e:
        error_msg = f'Failed to fetch metadata: {str(e)}. Try updating yt-dlp or checking URL access.'
        print(f"🎵 PYTHON BACKEND: ERROR: {error_msg}")
        print(f"🎵 PYTHON BACKEND: Exception type: {type(e).__name__}")
        import traceback
        print(f"🎵 PYTHON BACKEND: Traceback: {traceback.format_exc()}")
        return jsonify({'error': error_msg}), 500

@app.route('/process-audio', methods=['POST'])
def process_audio():
    """Process audio file and return waveform data"""
    try:
        data = request.get_json()
        audio_url = data.get('url')
        
        if not audio_url:
            return jsonify({'error': 'No audio URL provided'}), 400
        
        # Download audio file using yt-dlp
        print(f"Downloading audio from: {audio_url}")
        temp_file, duration = processor.download_audio(audio_url)
        
        if not temp_file:
            return jsonify({'error': 'Failed to download audio'}), 500
        
        print(f"Audio downloaded to: {temp_file}")
        
        # Generate waveform data
        print(f"Generating waveform data for: {temp_file}")
        waveform_data = processor.generate_waveform_data(temp_file)
        print(f"Waveform data result: {waveform_data is not None}")
        
        print(f"Generating waveform image for: {temp_file}")
        waveform_image = processor.create_waveform_image(temp_file)
        print(f"Waveform image result: {waveform_image is not None}")
        
        if waveform_data and waveform_image:
            return jsonify({
                'success': True,
                'waveform_data': waveform_data,
                'waveform_image': waveform_image,
                'duration': duration,
                'file_path': temp_file
            })
        else:
            error_msg = f'Failed to process audio - waveform_data: {waveform_data is not None}, waveform_image: {waveform_image is not None}'
            print(f"ERROR: {error_msg}")
            return jsonify({'error': error_msg}), 500
            
    except Exception as e:
        print(f"Process audio error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/split-audio', methods=['POST'])
def split_audio():
    """Split audio at specified points"""
    try:
        data = request.get_json()
        audio_url = data.get('url')
        split_points = data.get('split_points', [])
        format = data.get('format', 'mp3')
        
        if not audio_url or not split_points:
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Download audio file (simplified)
        temp_file = os.path.join(processor.temp_dir, f"audio_{uuid.uuid4()}.mp3")
        
        # Split audio
        segments, temp_files = processor.split_audio(temp_file, split_points, format)
        
        if segments:
            return jsonify({
                'success': True,
                'segments': segments
            })
        else:
            return jsonify({'error': 'Failed to split audio'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download-segment/<path:filename>')
def download_segment(filename):
    """Download a specific segment"""
    try:
        # In production, implement proper file serving
        return jsonify({'error': 'Download not implemented yet'}), 501
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("🎵 PYTHON BACKEND: Starting Audio Processor API...")
    print("🎵 PYTHON BACKEND: Server will run on http://localhost:5000")
    print("🎵 PYTHON BACKEND: Available endpoints:")
    print("🎵 PYTHON BACKEND:   POST /metadata - Extract metadata from URL")
    print("🎵 PYTHON BACKEND:   POST /process-audio - Process audio and generate waveform")
    print("🎵 PYTHON BACKEND:   POST /split-audio - Split audio at specified points")
    print("🎵 PYTHON BACKEND:   GET /download-segment/<filename> - Download audio segment")
    print("🎵 PYTHON BACKEND: Using main branch yt-dlp configuration for YouTube extraction")
    app.run(host='0.0.0.0', port=5000, debug=True)
