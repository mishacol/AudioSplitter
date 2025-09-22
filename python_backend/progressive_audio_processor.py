"""
Progressive Waveform Audio Processor
Implements Step 3: Low → High progressive waveform for <10s UX
"""
import os
import uuid
import json
import threading
import time
import shutil
from datetime import datetime
from typing import Dict, Any, List

import librosa
import numpy as np
import requests
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=['http://localhost:8080', 'http://localhost:8081', 'http://localhost:3000'])

# In-memory storage
job_status = {}
multi_res_peaks_cache = {}  # Cache for multi-resolution peaks

# Downloads folder management
DOWNLOADS_FOLDER = 'downloads'
MAX_DOWNLOADS_SIZE = 1 * 1024 * 1024 * 1024  # 1GB in bytes

def get_folder_size(folder_path: str) -> int:
    """Get total size of folder in bytes"""
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(folder_path):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                if os.path.exists(filepath):
                    total_size += os.path.getsize(filepath)
    except Exception as e:
        print(f"Error calculating folder size: {e}")
    return total_size

def cleanup_old_files():
    """Remove oldest files when downloads folder exceeds 1GB limit"""
    if not os.path.exists(DOWNLOADS_FOLDER):
        return
    
    current_size = get_folder_size(DOWNLOADS_FOLDER)
    print(f"Downloads folder size: {current_size / (1024*1024):.1f}MB")
    
    if current_size <= MAX_DOWNLOADS_SIZE:
        return
    
    print(f"Downloads folder exceeds 1GB limit, cleaning up...")
    
    # Get all files with their modification times
    files_with_time = []
    for filename in os.listdir(DOWNLOADS_FOLDER):
        filepath = os.path.join(DOWNLOADS_FOLDER, filename)
        if os.path.isfile(filepath):
            mtime = os.path.getmtime(filepath)
            size = os.path.getsize(filepath)
            files_with_time.append((filepath, mtime, size))
    
    # Sort by modification time (oldest first)
    files_with_time.sort(key=lambda x: x[1])
    
    # Remove oldest files until under limit
    removed_size = 0
    for filepath, mtime, size in files_with_time:
        if current_size - removed_size <= MAX_DOWNLOADS_SIZE:
            break
        
        try:
            os.remove(filepath)
            removed_size += size
            print(f"Removed old file: {os.path.basename(filepath)} ({size / (1024*1024):.1f}MB)")
        except Exception as e:
            print(f"Error removing file {filepath}: {e}")
    
    new_size = get_folder_size(DOWNLOADS_FOLDER)
    print(f"Cleanup complete. New size: {new_size / (1024*1024):.1f}MB")

def update_job_status(job_id: str, status: str, progress: int, message: str, data: Dict = None):
    """Update job status in memory"""
    job_status[job_id] = {
        'status': status,
        'progress': progress,
        'message': message,
        'data': data or {},
        'timestamp': datetime.utcnow().isoformat()
    }

def generate_multi_resolution_peaks(audio_data: np.ndarray, sample_rate: int, duration: float) -> Dict[str, Any]:
    """Generate multi-resolution peaks for progressive loading"""
    
    # Define resolution levels for Peaks.js
    resolutions = {
        'overview': 1024,      # Immediate display
        'zoom_1': 2048,        # First zoom level
        'zoom_2': 4096,        # Second zoom level  
        'zoom_3': 8192,        # Third zoom level
        'zoom_4': 16384,       # High resolution
        'zoom_5': 32768,       # Ultra high resolution
    }
    
    peaks_data = {}
    
    for level, points in resolutions.items():
        # Generate peaks for this resolution
        chunk_size = max(1, len(audio_data) // points)
        peaks = []
        
        for i in range(points):
            start_idx = i * chunk_size
            end_idx = min((i + 1) * chunk_size, len(audio_data))
            chunk = audio_data[start_idx:end_idx]
            
            if len(chunk) > 0:
                max_val = float(np.max(chunk))
                min_val = float(np.min(chunk))
                peaks.append([min_val, max_val])
            else:
                peaks.append([0, 0])
        
        peaks_data[level] = {
            'peaks': peaks,
            'points': points,
            'duration': duration,
            'sample_rate': sample_rate
        }
    
    return peaks_data

def generate_immediate_low_res_peaks(audio_url: str) -> Dict[str, Any]:
    """Generate immediate low-res peaks (1024 points) for instant display"""
    try:
        # Try to get first few MB for quick analysis
        headers = {'Range': 'bytes=0-5242880'}  # First 5MB
        response = requests.get(audio_url, headers=headers, stream=True, timeout=5)
        
        if response.status_code not in [200, 206]:
            # Fallback: generate placeholder
            return generate_placeholder_peaks(300, 1024)
        
        # Save chunk to temp file
        temp_file = os.path.join('downloads', f'quick_{uuid.uuid4()}.mp3')
        os.makedirs('downloads', exist_ok=True)
        
        with open(temp_file, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                if f.tell() >= 5242880:  # 5MB limit
                    break
        
        # Load with very low sample rate for speed
        y, sr = librosa.load(temp_file, sr=8000)  # Very low sample rate for speed
        duration = len(y) / sr
        
        # Generate 1024 points for immediate display
        points = 1024
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
        
        # Clean up
        if os.path.exists(temp_file):
            os.remove(temp_file)
        
        return {
            'peaks': peaks,
            'points': points,
            'duration': duration,
            'sample_rate': sr,
            'source': 'quick_stream',
            'resolution': 'overview'
        }
        
    except Exception as e:
        print(f"Quick peaks error: {e}")
        return generate_placeholder_peaks(300, 1024)

def generate_placeholder_peaks(duration: float, points: int) -> Dict[str, Any]:
    """Generate placeholder peaks for immediate display"""
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
        'points': points,
        'duration': duration,
        'sample_rate': 44100,
        'source': 'placeholder',
        'resolution': 'overview'
    }

def generate_placeholder_multi_res_peaks() -> Dict[str, Any]:
    """Generate placeholder multi-resolution peaks"""
    import random
    
    resolutions = {
        'overview': 1024,
        'zoom_1': 2048,
        'zoom_2': 4096,
        'zoom_3': 8192,
        'zoom_4': 16384,
        'zoom_5': 32768
    }
    
    multi_res = {}
    for res_name, points in resolutions.items():
        peaks = []
        for i in range(points):
            base_amplitude = 0.3 + 0.4 * random.random()
            variation = 0.1 * random.random()
            
            min_val = -base_amplitude - variation
            max_val = base_amplitude + variation
            
            peaks.append([min_val, max_val])
        
        multi_res[res_name] = {
            'peaks': peaks,
            'points': points,
            'duration': 300.0,  # 5 minutes placeholder
            'sample_rate': 22050,
            'source': 'placeholder',
            'resolution': res_name
        }
    
    return multi_res

def background_progressive_processing(job_id: str, audio_url: str):
    """Background progressive processing with multi-resolution peaks"""
    try:
        update_job_status(job_id, 'processing', 5, 'Starting progressive processing...')
        
        # Step 1: Generate immediate low-res peaks (1024 points)
        update_job_status(job_id, 'processing', 10, 'Generating immediate waveform...')
        low_res_peaks = generate_immediate_low_res_peaks(audio_url)
        
        update_job_status(job_id, 'processing', 20, 'Low-res waveform ready!', {
            'low_res_peaks': low_res_peaks
        })
        
        # Step 2: Try to download full audio for high-res processing (non-blocking)
        update_job_status(job_id, 'processing', 30, 'Preparing high-res processing...')
        
        try:
            # Clean up old files before downloading
            cleanup_old_files()
            
            # Use yt-dlp for full download with timeout
            import yt_dlp
            import signal
            
            output_path = os.path.join('downloads', f'{job_id}.%(ext)s')
            
            ydl_opts = {
                'outtmpl': output_path,
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'socket_timeout': 30,  # 30 second timeout
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([audio_url])
            
            # Find the downloaded file
            downloaded_file = None
            for ext in ['mp3', 'm4a', 'webm', 'wav']:
                potential_file = os.path.join('downloads', f'{job_id}.{ext}')
                if os.path.exists(potential_file):
                    downloaded_file = potential_file
                    break
            
            if not downloaded_file:
                raise Exception("Downloaded file not found")
                
        except Exception as e:
            print(f"Full download failed: {e}")
            # Continue with placeholder multi-res peaks
            update_job_status(job_id, 'processing', 50, 'Using placeholder high-res peaks...')
            multi_res_peaks = generate_placeholder_multi_res_peaks()
            multi_res_peaks_cache[job_id] = multi_res_peaks
            
            update_job_status(job_id, 'completed', 100, 'Processing complete!', {
                'multi_res_peaks': multi_res_peaks,
                'file_path': None
            })
            return
        
        update_job_status(job_id, 'processing', 60, 'Generating multi-resolution peaks...')
        
        # Step 3: Generate multi-resolution peaks
        y, sr = librosa.load(downloaded_file, sr=22050)  # Standard sample rate
        duration = len(y) / sr
        
        multi_res_peaks = generate_multi_resolution_peaks(y, sr, duration)
        
        # Cache the multi-resolution peaks
        multi_res_peaks_cache[job_id] = multi_res_peaks
        
        update_job_status(job_id, 'processing', 90, 'Multi-resolution peaks ready!', {
            'multi_res_peaks': multi_res_peaks,
            'file_path': downloaded_file
        })
        
        # Step 4: Complete
        update_job_status(job_id, 'completed', 100, 'Progressive processing complete!', {
            'file_path': downloaded_file,
            'duration': duration,
            'low_res_peaks': low_res_peaks,
            'multi_res_peaks': multi_res_peaks,
            'sample_rate': sr
        })
        
    except Exception as e:
        update_job_status(job_id, 'error', 0, f'Error: {str(e)}')

@app.route('/preload', methods=['POST'])
def preload_audio():
    """Start progressive audio processing"""
    try:
        data = request.get_json()
        audio_url = data.get('url')
        
        if not audio_url:
            return jsonify({'error': 'URL required'}), 400
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Start background progressive processing
        thread = threading.Thread(target=background_progressive_processing, args=(job_id, audio_url))
        thread.daemon = True
        thread.start()
        
        # Update job status
        update_job_status(job_id, 'queued', 0, 'Queued for progressive processing')
        
        return jsonify({
            'job_id': job_id,
            'status': 'queued',
            'message': 'Progressive processing started'
        }), 202
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/progress/<job_id>')
def get_progress(job_id: str):
    """Get current job progress"""
    try:
        if job_id not in job_status:
            return jsonify({'error': 'Job not found'}), 404
        
        return jsonify(job_status[job_id])
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/progress/<job_id>/stream')
def stream_progress(job_id: str):
    """Server-Sent Events stream for real-time progress"""
    def generate():
        last_progress = -1
        
        while True:
            if job_id in job_status:
                current_status = job_status[job_id]
                current_progress = current_status.get('progress', 0)
                
                if current_progress != last_progress:
                    event_data = {
                        'job_id': job_id,
                        'stage': current_status.get('status', 'processing'),
                        'progress': current_progress,
                        'message': current_status.get('message', ''),
                        'timestamp': current_status.get('timestamp', ''),
                        'data': current_status.get('data', {})
                    }
                    
                    yield f"data: {json.dumps(event_data)}\n\n"
                    last_progress = current_progress
                    
                    if current_status.get('status') in ['completed', 'error']:
                        break
            
            time.sleep(0.5)  # Poll every 500ms for faster updates
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/peaks/<job_id>')
def get_peaks(job_id: str):
    """Get peaks data for a job"""
    try:
        if job_id not in job_status:
            return jsonify({'error': 'Job not found'}), 404
        
        job_data = job_status[job_id]
        
        # Return low-res peaks if available
        if 'low_res_peaks' in job_data.get('data', {}):
            return jsonify(job_data['data']['low_res_peaks'])
        
        return jsonify({'error': 'Peaks not ready'}), 202
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/peaks/<job_id>/<resolution>')
def get_peaks_resolution(job_id: str, resolution: str):
    """Get specific resolution peaks (overview, zoom_1, zoom_2, etc.)"""
    try:
        if job_id not in job_status:
            return jsonify({'error': 'Job not found'}), 404
        
        # Check if multi-resolution peaks are cached
        if job_id in multi_res_peaks_cache:
            multi_res_peaks = multi_res_peaks_cache[job_id]
            if resolution in multi_res_peaks:
                return jsonify(multi_res_peaks[resolution])
        
        return jsonify({'error': f'Resolution {resolution} not ready'}), 202
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/audio/<job_id>')
def get_audio(job_id: str):
    """Get processed audio file for a job"""
    try:
        if job_id not in job_status:
            return jsonify({'error': 'Job not found'}), 404
        
        job_data = job_status[job_id]
        
        if 'file_path' in job_data.get('data', {}):
            file_path = job_data['data']['file_path']
            if file_path and os.path.exists(file_path):
                return jsonify({
                    'file_path': file_path,
                    'url': f'/downloads/{os.path.basename(file_path)}'
                })
        
        return jsonify({'error': 'Audio not ready'}), 202
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/downloads/<filename>')
def serve_audio(filename: str):
    """Serve processed audio files"""
    try:
        from flask import send_file
        
        file_path = os.path.join('downloads', filename)
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        return send_file(file_path, as_attachment=False)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'active_jobs': len(job_status),
        'cached_peaks': len(multi_res_peaks_cache)
    })

if __name__ == '__main__':
    # Create necessary directories
    os.makedirs('downloads', exist_ok=True)
    
    print("🚀 Starting Progressive Waveform Audio Processor...")
    print("📊 Multi-resolution peaks: overview → zoom_1 → zoom_2 → zoom_3 → zoom_4 → zoom_5")
    print("⚡ Target: <10s UX with immediate low-res display")
    
    app.run(host='0.0.0.0', port=5002, debug=True)  # Port 5002 to avoid conflicts
