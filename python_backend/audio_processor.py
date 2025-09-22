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
import threading
import time
from datetime import datetime
import requests

app = Flask(__name__)
CORS(app)

# Global job tracking
job_status = {}
job_lock = threading.Lock()

def update_job_status(job_id, status, progress=0, message="", data=None):
    """Update job status thread-safely"""
    with job_lock:
        job_status[job_id] = {
            'status': status,  # 'queued', 'processing', 'completed', 'error'
            'progress': progress,  # 0-100
            'message': message,
            'data': data,
            'timestamp': datetime.now().isoformat()
        }

def background_process_audio(job_id, audio_url):
    """Background audio processing function - optimized for large files"""
    try:
        update_job_status(job_id, 'processing', 5, 'Analyzing file size...')
        
        processor = AudioProcessor()
        
        # Get file info first (fast)
        file_info = processor.get_file_info(audio_url)
        file_size_mb = file_info.get('file_size_mb', 0)
        
        update_job_status(job_id, 'processing', 10, f'File size: {file_size_mb:.1f} MB')
        
        # For large files (>50MB), generate placeholder peaks immediately
        if file_size_mb > 50:
            update_job_status(job_id, 'processing', 20, 'Large file detected - generating placeholder...')
            
            # Generate placeholder peaks (no download)
            placeholder_peaks = processor.generate_placeholder_peaks(file_info.get('duration', 0), points=1024)
            
            update_job_status(job_id, 'completed', 100, 'Placeholder ready - download on demand', {
                'file_path': None,  # No file downloaded yet
                'duration': file_info.get('duration', 0),
                'low_res_peaks': placeholder_peaks,
                'file_size_mb': file_size_mb,
                'download_on_demand': True
            })
            return
        
        # For smaller files, proceed with normal processing
        update_job_status(job_id, 'processing', 15, 'Generating quick waveform...')
        low_res_peaks = processor.generate_quick_peaks_from_stream(audio_url, points=1024)
        
        if low_res_peaks:
            update_job_status(job_id, 'processing', 25, 'Quick waveform ready!', {
                'low_res_peaks': low_res_peaks
            })
        
        # Continue with full download
        update_job_status(job_id, 'processing', 30, 'Downloading audio...')
        filename, duration = processor.download_audio(audio_url)
        if not filename:
            raise Exception("Failed to download audio")
        
        update_job_status(job_id, 'processing', 70, 'Generating full waveform...')
        waveform_data = processor.generate_waveform_data(filename)
        
        update_job_status(job_id, 'completed', 100, 'Processing complete', {
            'file_path': filename,
            'duration': duration,
            'low_res_peaks': low_res_peaks,
            'waveform_data': waveform_data
        })
        
    except Exception as e:
        update_job_status(job_id, 'error', 0, f'Error: {str(e)}')

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

    def generate_low_res_peaks(self, audio_url, points=1024):
        """Generate low-resolution peaks quickly for immediate waveform display"""
        try:
            # Download just enough to get basic info
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': os.path.join(self.temp_dir, 'temp_%(id)s.%(ext)s'),
                'extractaudio': True,
                'audioformat': 'mp3',
                'noplaylist': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(audio_url, download=True)
                filename = ydl.prepare_filename(info)
                
                # Convert to mp3 if needed
                if not filename.endswith('.mp3'):
                    audio = AudioSegment.from_file(filename)
                    mp3_filename = filename.rsplit('.', 1)[0] + '.mp3'
                    audio.export(mp3_filename, format='mp3')
                    os.remove(filename)
                    filename = mp3_filename
            
            # Load audio with low sample rate for speed
            y, sr = librosa.load(filename, sr=8000)  # Low sample rate for speed
            duration = len(y) / sr
            
            # Generate simple peaks array
            chunk_size = len(y) // points
            peaks = []
            
            for i in range(points):
                start_idx = i * chunk_size
                end_idx = min((i + 1) * chunk_size, len(y))
                chunk = y[start_idx:end_idx]
                
                if len(chunk) > 0:
                    max_val = float(np.max(chunk))
                    min_val = float(np.min(chunk))
                    peaks.append([min_val, max_val])
                else:
                    peaks.append([0, 0])
            
            # Clean up temp file
            if os.path.exists(filename):
                os.remove(filename)
            
            return {
                'peaks': peaks,
                'duration': duration,
                'sample_rate': sr,
                'points': points
            }
            
        except Exception as e:
            print(f"Low-res peaks generation error: {e}")
            return None

    def generate_quick_peaks_from_stream(self, audio_url, points=1024, max_bytes=10*1024*1024):
        """Generate peaks from first few MB of stream for immediate display"""
        try:
            import requests
            
            # Stream only first few MB
            headers = {'Range': f'bytes=0-{max_bytes}'}
            response = requests.get(audio_url, headers=headers, stream=True, timeout=10)
            
            if response.status_code not in [200, 206]:  # 206 = Partial Content
                print(f"Stream request failed: {response.status_code}")
                return None
            
            # Save first chunk to temp file
            temp_file = os.path.join(self.temp_dir, f'quick_{uuid.uuid4()}.mp3')
            
            with open(temp_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    if f.tell() >= max_bytes:
                        break
            
            # Load audio with very low sample rate for speed
            y, sr = librosa.load(temp_file, sr=4000)  # Very low sample rate
            duration = len(y) / sr
            
            # Generate simple peaks array
            chunk_size = max(1, len(y) // points)
            peaks = []
            
            for i in range(points):
                start_idx = i * chunk_size
                end_idx = min((i + 1) * chunk_size, len(y))
                chunk = y[start_idx:end_idx]
                
                if len(chunk) > 0:
                    max_val = float(np.max(chunk))
                    min_val = float(np.min(chunk))
                    peaks.append([min_val, max_val])
                else:
                    peaks.append([0, 0])
            
            # Clean up temp file
            if os.path.exists(temp_file):
                os.remove(temp_file)
            
            return {
                'peaks': peaks,
                'duration': duration,
                'sample_rate': sr,
                'points': points,
                'source': 'stream_preview'
            }
            
        except Exception as e:
            print(f"Quick peaks generation error: {e}")
            return None

    def get_file_info(self, audio_url):
        """Get file info without downloading"""
        try:
            import requests
            
            # Get HEAD request to get file size
            response = requests.head(audio_url, timeout=10)
            content_length = response.headers.get('content-length')
            
            file_size_mb = 0
            if content_length:
                file_size_mb = int(content_length) / (1024 * 1024)
            
            # Try to get duration from metadata
            duration = 0
            try:
                ydl_opts = {
                    'quiet': True,
                    'no_warnings': True,
                    'extract_flat': False,
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(audio_url, download=False)
                    duration = info.get('duration', 0)
            except:
                pass
            
            return {
                'file_size_mb': file_size_mb,
                'duration': duration,
                'content_type': response.headers.get('content-type', '')
            }
            
        except Exception as e:
            print(f"File info error: {e}")
            return {'file_size_mb': 0, 'duration': 0}

    def generate_placeholder_peaks(self, duration, points=1024):
        """Generate placeholder peaks for large files (no download)"""
        try:
            # Generate random-ish peaks that look like audio
            import random
            peaks = []
            
            for i in range(points):
                # Create some variation to look like real audio
                base_amplitude = 0.3 + 0.4 * random.random()
                variation = 0.1 * random.random()
                
                min_val = -base_amplitude - variation
                max_val = base_amplitude + variation
                
                peaks.append([min_val, max_val])
            
            return {
                'peaks': peaks,
                'duration': duration,
                'sample_rate': 44100,
                'points': points,
                'source': 'placeholder',
                'note': 'Placeholder waveform for large file'
            }
            
        except Exception as e:
            print(f"Placeholder peaks error: {e}")
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

@app.route('/preload', methods=['POST'])
def preload_audio():
    """Non-blocking audio preload - returns job_id immediately"""
    try:
        data = request.get_json()
        audio_url = data.get('audio_url')
        
        if not audio_url:
            return jsonify({'error': 'No audio URL provided'}), 400
        
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Initialize job status
        update_job_status(job_id, 'queued', 0, 'Job queued')
        
        # Start background processing
        thread = threading.Thread(target=background_process_audio, args=(job_id, audio_url))
        thread.daemon = True
        thread.start()
        
        # Return job_id immediately
        return jsonify({
            'job_id': job_id,
            'status': 'queued',
            'message': 'Processing started in background'
        }), 202
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/progress/<job_id>', methods=['GET'])
def get_progress(job_id):
    """Get job progress"""
    try:
        with job_lock:
            if job_id not in job_status:
                return jsonify({'error': 'Job not found'}), 404
            
            status = job_status[job_id]
            return jsonify(status)
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/peaks/<job_id>', methods=['GET'])
def get_peaks(job_id):
    """Get low-res peaks data for a job"""
    try:
        with job_lock:
            if job_id not in job_status:
                return jsonify({'error': 'Job not found'}), 404
            
            status = job_status[job_id]
            if status['status'] != 'completed':
                return jsonify({'error': 'Job not completed yet'}), 202
            
            data = status.get('data', {})
            low_res_peaks = data.get('low_res_peaks')
            
            if low_res_peaks:
                return jsonify(low_res_peaks)
            else:
                return jsonify({'error': 'No peaks data available'}), 404
                
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/metadata', methods=['POST'])
def extract_metadata():
    """Extract metadata from URL using yt-dlp without downloading"""
    try:
        data = request.get_json()
        url = data.get('url')
        
        if not url:
            return jsonify({'error': 'No URL provided'}), 400
        
        print(f"Fetching metadata for URL: {url}")  # Debug log
        
        ydl_opts = {
            'quiet': False,  # Enable verbose for logs
            'no_warnings': False,
            'extract_flat': False,  # Full extraction for metadata
            'skip_download': True,
            'sleep_interval': 1,  # Avoid rate limits
            'max_sleep_interval': 5,
            'extractor_args': {
                'youtube': [
                    'skip=hls,no_check_certificate'  # Skip HLS and cert issues
                ]
            },
            'format': 'bestaudio[ext=m4a]/bestaudio/best',  # Prefer M4A audio
            'noplaylist': True,  # Only extract first video, not entire playlist
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            print(f"Raw info keys: {list(info.keys()) if info else 'None'}")  # Debug: Check extracted fields
            
            if 'entries' in info and info['entries']:
                entry = info['entries'][0]  # Take first for radio/playlist
                print(f"Using entry[0]: {entry.get('title', 'No title')}")  # Debug
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
            
            # Try to get direct audio URL from formats
            if 'formats' in info:
                audio_formats = [f for f in info['formats'] if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
                if audio_formats:
                    best_audio = max(audio_formats, key=lambda f: f.get('abr', 0))  # Highest bitrate
                    metadata['direct_audio_url'] = best_audio.get('url')
                    metadata['format'] = best_audio.get('ext', metadata['format'])
                    print(f"Selected audio format: {metadata['format']}")  # Debug
            
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
            
            print(f"Final metadata: {json.dumps(metadata, indent=2)}")  # Debug log
            return jsonify(metadata)
            
    except Exception as e:
        error_msg = f'Failed to fetch metadata: {str(e)}. Try updating yt-dlp or checking URL access.'
        print(f"ERROR: {error_msg}")  # Log error
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
    app.run(host='0.0.0.0', port=5000, debug=True)
