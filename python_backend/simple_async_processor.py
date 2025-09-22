"""
Simplified async audio processor without Redis dependency
Uses threading and in-memory storage for immediate testing
"""
import os
import uuid
import json
import threading
import time
from datetime import datetime
from typing import Dict, Any

from flask import Flask, request, jsonify, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=['http://localhost:8080', 'http://localhost:8081', 'http://localhost:3000'])

# In-memory storage (replace Redis)
job_status = {}
progress_subscribers = {}  # job_id -> list of callbacks

def update_job_status(job_id: str, status: str, progress: int, message: str, data: Dict = None):
    """Update job status in memory"""
    job_status[job_id] = {
        'status': status,
        'progress': progress,
        'message': message,
        'data': data or {},
        'timestamp': datetime.utcnow().isoformat()
    }
    
    # Notify subscribers
    if job_id in progress_subscribers:
        for callback in progress_subscribers[job_id]:
            try:
                callback({
                    'job_id': job_id,
                    'stage': status,
                    'progress': progress,
                    'message': message,
                    'timestamp': datetime.utcnow().isoformat(),
                    'data': data or {}
                })
            except:
                pass

def background_process_audio(job_id: str, audio_url: str):
    """Background audio processing function"""
    try:
        update_job_status(job_id, 'processing', 5, 'Analyzing file size...')
        
        # Simulate file size check
        import requests
        try:
            head_response = requests.head(audio_url, timeout=10)
            file_size = int(head_response.headers.get('content-length', 0))
            file_size_mb = file_size / (1024 * 1024)
        except:
            file_size_mb = 0
        
        update_job_status(job_id, 'processing', 10, f'File size: {file_size_mb:.1f} MB')
        
        # For large files (>50MB), generate placeholder peaks immediately
        if file_size_mb > 50:
            update_job_status(job_id, 'processing', 20, 'Large file detected - generating placeholder...')
            
            # Generate placeholder peaks
            import random
            peaks = []
            points = 1024
            
            for i in range(points):
                base_amplitude = 0.3 + 0.4 * random.random()
                variation = 0.1 * random.random()
                min_val = -base_amplitude - variation
                max_val = base_amplitude + variation
                peaks.append([min_val, max_val])
            
            placeholder_data = {
                'peaks': peaks,
                'duration': 3600,  # 1 hour placeholder
                'sample_rate': 44100,
                'points': points,
                'source': 'placeholder',
                'note': 'Placeholder waveform for large file'
            }
            
            update_job_status(job_id, 'processing', 30, 'Placeholder ready', {'low_res_peaks': placeholder_data})
            
            # Simulate processing completion
            time.sleep(2)
            update_job_status(job_id, 'completed', 100, 'Processing complete', {
                'file_path': None,
                'duration': 3600,
                'low_res_peaks': placeholder_data,
                'file_size_mb': file_size_mb,
                'download_on_demand': True
            })
            return
        
        # For smaller files, try quick stream peaks
        update_job_status(job_id, 'processing', 15, 'Generating quick waveform...')
        
        try:
            # Stream first 10MB
            headers = {'Range': 'bytes=0-10485760'}
            response = requests.get(audio_url, headers=headers, stream=True, timeout=10)
            
            if response.status_code not in [200, 206]:
                raise Exception(f"Stream request failed: {response.status_code}")
            
            # Save chunk to temp file
            temp_file = os.path.join('downloads', f'quick_{uuid.uuid4()}.mp3')
            os.makedirs('downloads', exist_ok=True)
            
            with open(temp_file, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    if f.tell() >= 10485760:  # 10MB limit
                        break
            
            update_job_status(job_id, 'processing', 40, 'Processing audio chunk...')
            
            # Generate simple peaks (simplified)
            import librosa
            import numpy as np
            
            y, sr = librosa.load(temp_file, sr=4000)  # Low sample rate for speed
            duration = len(y) / sr
            
            # Generate peaks
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
            
            low_res_data = {
                'peaks': peaks,
                'duration': duration,
                'sample_rate': sr,
                'points': points,
                'source': 'stream_preview'
            }
            
            update_job_status(job_id, 'processing', 60, 'Quick waveform ready', {'low_res_peaks': low_res_data})
            
            # Simulate full processing
            time.sleep(3)
            update_job_status(job_id, 'processing', 80, 'Generating full waveform...')
            time.sleep(2)
            
            update_job_status(job_id, 'completed', 100, 'Processing complete', {
                'file_path': f'downloads/processed_{uuid.uuid4()}.mp3',
                'duration': duration,
                'low_res_peaks': low_res_data,
                'waveform_data': low_res_data  # Simplified
            })
            
        except Exception as e:
            print(f"Quick peaks error: {e}")
            # Fallback to placeholder
            placeholder_data = {
                'peaks': [[0, 0]] * 1024,
                'duration': 300,  # 5 minutes placeholder
                'sample_rate': 44100,
                'points': 1024,
                'source': 'placeholder',
                'note': 'Fallback placeholder'
            }
            
            update_job_status(job_id, 'completed', 100, 'Processing complete (placeholder)', {
                'file_path': None,
                'duration': 300,
                'low_res_peaks': placeholder_data,
                'download_on_demand': True
            })
            
    except Exception as e:
        update_job_status(job_id, 'error', 0, f'Error: {str(e)}')

@app.route('/preload', methods=['POST'])
def preload_audio():
    """Start async audio processing"""
    try:
        data = request.get_json()
        audio_url = data.get('url')
        
        if not audio_url:
            return jsonify({'error': 'URL required'}), 400
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Start background processing
        thread = threading.Thread(target=background_process_audio, args=(job_id, audio_url))
        thread.daemon = True
        thread.start()
        
        # Update job status
        update_job_status(job_id, 'queued', 0, 'Queued for processing')
        
        return jsonify({
            'job_id': job_id,
            'status': 'queued',
            'message': 'Processing started'
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
        # Simple polling implementation (no Redis pubsub)
        last_progress = -1
        
        while True:
            if job_id in job_status:
                current_status = job_status[job_id]
                current_progress = current_status.get('progress', 0)
                
                # Only send if progress changed
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
                    
                    # Stop if completed or error
                    if current_status.get('status') in ['completed', 'error']:
                        break
            
            time.sleep(1)  # Poll every second
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/peaks/<job_id>')
def get_peaks(job_id: str):
    """Get peaks data for a job"""
    try:
        if job_id not in job_status:
            return jsonify({'error': 'Job not found'}), 404
        
        job_data = job_status[job_id]
        
        # Check if low-res peaks are ready
        if 'low_res_peaks' in job_data.get('data', {}):
            return jsonify(job_data['data']['low_res_peaks'])
        
        return jsonify({'error': 'Peaks not ready'}), 202
        
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

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'redis_connected': False,  # No Redis in this version
        'jobs_count': len(job_status)
    })

@app.route('/jobs')
def list_jobs():
    """List all active jobs"""
    return jsonify({
        'jobs': job_status,
        'count': len(job_status)
    })

if __name__ == '__main__':
    # Create necessary directories
    os.makedirs('downloads', exist_ok=True)
    
    print("🚀 Starting Simple Async Audio Processor...")
    print("📡 No Redis dependency - using in-memory storage")
    
    app.run(host='0.0.0.0', port=5001, debug=True)  # Different port to avoid conflict
