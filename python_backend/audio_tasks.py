"""
Async audio processing tasks using Celery
"""
import os
import uuid
import hashlib
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

import redis
import librosa
import numpy as np
import requests
from celery import current_task
from celery_config import celery_app, REDIS_URL

# Redis client for progress events
redis_client = redis.from_url(REDIS_URL)

class AudioProcessor:
    """Enhanced audio processor with async capabilities"""
    
    def __init__(self):
        self.temp_dir = "downloads"
        os.makedirs(self.temp_dir, exist_ok=True)
        
        # Cache directory for processed files
        self.cache_dir = "cache"
        os.makedirs(self.cache_dir, exist_ok=True)
    
    def get_cache_key(self, url: str, options: Dict[str, Any] = None) -> str:
        """Generate content hash for caching"""
        cache_data = {
            'url': url,
            'options': options or {},
            'version': '1.0'  # Increment when processing logic changes
        }
        return hashlib.md5(json.dumps(cache_data, sort_keys=True).encode()).hexdigest()
    
    def publish_progress(self, job_id: str, stage: str, progress: int, message: str, data: Dict = None):
        """Publish progress event to Redis pubsub"""
        event = {
            'job_id': job_id,
            'stage': stage,
            'progress': progress,
            'message': message,
            'timestamp': datetime.utcnow().isoformat(),
            'data': data or {}
        }
        
        # Publish to Redis channel
        redis_client.publish(f'audio_progress:{job_id}', json.dumps(event))
        
        # Also update task progress
        current_task.update_state(
            state='PROGRESS',
            meta={
                'stage': stage,
                'progress': progress,
                'message': message,
                'data': data or {}
            }
        )

@celery_app.task(bind=True, name='audio_tasks.quick_probe')
def quick_probe(self, audio_url: str) -> Dict[str, Any]:
    """
    Task A: Quick stream analysis
    Determine stream type, duration, available formats
    """
    job_id = self.request.id
    processor = AudioProcessor()
    
    try:
        processor.publish_progress(job_id, 'probe', 10, 'Analyzing stream...')
        
        # Try yt-dlp info extraction (fast)
        import yt_dlp
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(audio_url, download=False)
            
            result = {
                'url': audio_url,
                'title': info.get('title', 'Unknown'),
                'duration': info.get('duration', 0),
                'formats': info.get('formats', []),
                'is_live': info.get('is_live', False),
                'extractor': info.get('extractor', 'unknown'),
                'file_size': info.get('filesize', 0),
                'cache_key': processor.get_cache_key(audio_url)
            }
            
            processor.publish_progress(job_id, 'probe', 100, 'Stream analysis complete', result)
            return result
            
    except Exception as e:
        processor.publish_progress(job_id, 'probe', 0, f'Probe failed: {str(e)}')
        raise

@celery_app.task(bind=True, name='audio_tasks.low_res_peaks')
def low_res_peaks(self, audio_url: str, probe_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Task B: Generate low-resolution peaks for immediate display
    """
    job_id = self.request.id
    processor = AudioProcessor()
    
    try:
        processor.publish_progress(job_id, 'low_peaks', 10, 'Generating quick waveform...')
        
        # For large files, generate placeholder immediately
        file_size_mb = probe_data.get('file_size', 0) / (1024 * 1024)
        duration = probe_data.get('duration', 0)
        
        if file_size_mb > 50:
            processor.publish_progress(job_id, 'low_peaks', 50, 'Large file - generating placeholder...')
            
            # Generate placeholder peaks
            peaks = []
            points = 1024
            
            for i in range(points):
                base_amplitude = 0.3 + 0.4 * (i % 100) / 100
                variation = 0.1 * (i % 50) / 50
                min_val = -base_amplitude - variation
                max_val = base_amplitude + variation
                peaks.append([min_val, max_val])
            
            result = {
                'peaks': peaks,
                'duration': duration,
                'sample_rate': 44100,
                'points': points,
                'source': 'placeholder',
                'cache_key': processor.get_cache_key(audio_url)
            }
            
            processor.publish_progress(job_id, 'low_peaks', 100, 'Placeholder ready', result)
            return result
        
        # For smaller files, try quick stream peaks
        processor.publish_progress(job_id, 'low_peaks', 30, 'Streaming first chunk...')
        
        headers = {'Range': 'bytes=0-10485760'}  # First 10MB
        response = requests.get(audio_url, headers=headers, stream=True, timeout=10)
        
        if response.status_code not in [200, 206]:
            raise Exception(f"Stream request failed: {response.status_code}")
        
        # Save chunk to temp file
        temp_file = os.path.join(processor.temp_dir, f'quick_{uuid.uuid4()}.mp3')
        
        with open(temp_file, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                if f.tell() >= 10485760:  # 10MB limit
                    break
        
        processor.publish_progress(job_id, 'low_peaks', 60, 'Processing audio chunk...')
        
        # Load with low sample rate for speed
        y, sr = librosa.load(temp_file, sr=4000)
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
        
        result = {
            'peaks': peaks,
            'duration': duration,
            'sample_rate': sr,
            'points': points,
            'source': 'stream_preview',
            'cache_key': processor.get_cache_key(audio_url)
        }
        
        processor.publish_progress(job_id, 'low_peaks', 100, 'Quick waveform ready', result)
        return result
        
    except Exception as e:
        processor.publish_progress(job_id, 'low_peaks', 0, f'Low-res peaks failed: {str(e)}')
        raise

@celery_app.task(bind=True, name='audio_tasks.progressive_download')
def progressive_download(self, audio_url: str, probe_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Task C: Progressive download and conversion
    """
    job_id = self.request.id
    processor = AudioProcessor()
    
    try:
        processor.publish_progress(job_id, 'download', 10, 'Starting download...')
        
        # Use yt-dlp for download
        import yt_dlp
        
        cache_key = processor.get_cache_key(audio_url)
        output_path = os.path.join(processor.cache_dir, f'{cache_key}.%(ext)s')
        
        ydl_opts = {
            'outtmpl': output_path,
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'progress_hooks': [lambda d: processor.publish_progress(
                job_id, 'download', 
                int(d.get('_percent_str', '0%').replace('%', '')), 
                f"Downloading: {d.get('_percent_str', '0%')}"
            )],
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([audio_url])
        
        # Find the downloaded file
        downloaded_file = None
        for ext in ['mp3', 'm4a', 'webm', 'wav']:
            potential_file = os.path.join(processor.cache_dir, f'{cache_key}.{ext}')
            if os.path.exists(potential_file):
                downloaded_file = potential_file
                break
        
        if not downloaded_file:
            raise Exception("Downloaded file not found")
        
        processor.publish_progress(job_id, 'download', 100, 'Download complete', {
            'file_path': downloaded_file,
            'file_size': os.path.getsize(downloaded_file)
        })
        
        return {
            'file_path': downloaded_file,
            'cache_key': cache_key,
            'file_size': os.path.getsize(downloaded_file)
        }
        
    except Exception as e:
        processor.publish_progress(job_id, 'download', 0, f'Download failed: {str(e)}')
        raise

@celery_app.task(bind=True, name='audio_tasks.high_res_peaks')
def high_res_peaks(self, file_path: str, cache_key: str) -> Dict[str, Any]:
    """
    Task D: Generate high-resolution peaks for Peaks.js
    """
    job_id = self.request.id
    processor = AudioProcessor()
    
    try:
        processor.publish_progress(job_id, 'high_peaks', 10, 'Loading audio for high-res peaks...')
        
        # Load audio
        y, sr = librosa.load(file_path, sr=22050)  # Standard sample rate
        duration = len(y) / sr
        
        processor.publish_progress(job_id, 'high_peaks', 30, 'Generating multi-resolution peaks...')
        
        # Generate multiple resolution levels for Peaks.js
        resolutions = {
            'overview': 1024,      # Overview level
            'zoom_1': 2048,        # First zoom level
            'zoom_2': 4096,        # Second zoom level
            'zoom_3': 8192,        # Third zoom level
        }
        
        peaks_data = {}
        
        for level, points in resolutions.items():
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
            
            peaks_data[level] = peaks
        
        result = {
            'peaks_data': peaks_data,
            'duration': duration,
            'sample_rate': sr,
            'cache_key': cache_key
        }
        
        processor.publish_progress(job_id, 'high_peaks', 100, 'High-res peaks ready', result)
        return result
        
    except Exception as e:
        processor.publish_progress(job_id, 'high_peaks', 0, f'High-res peaks failed: {str(e)}')
        raise

@celery_app.task(bind=True, name='audio_tasks.postprocess_cache')
def postprocess_cache(self, file_path: str, peaks_data: Dict[str, Any], cache_key: str) -> Dict[str, Any]:
    """
    Task E: Final postprocessing and caching
    """
    job_id = self.request.id
    processor = AudioProcessor()
    
    try:
        processor.publish_progress(job_id, 'postprocess', 10, 'Finalizing processing...')
        
        # Save peaks data to cache
        peaks_file = os.path.join(processor.cache_dir, f'{cache_key}_peaks.json')
        with open(peaks_file, 'w') as f:
            json.dump(peaks_data, f)
        
        processor.publish_progress(job_id, 'postprocess', 50, 'Caching complete...')
        
        # Set cache expiration (7 days)
        expiration = datetime.utcnow() + timedelta(days=7)
        
        result = {
            'file_path': file_path,
            'peaks_file': peaks_file,
            'cache_key': cache_key,
            'expiration': expiration.isoformat(),
            'status': 'complete'
        }
        
        processor.publish_progress(job_id, 'postprocess', 100, 'Processing complete!', result)
        return result
        
    except Exception as e:
        processor.publish_progress(job_id, 'postprocess', 0, f'Postprocess failed: {str(e)}')
        raise

# Workflow orchestration
@celery_app.task(bind=True, name='audio_tasks.process_audio_workflow')
def process_audio_workflow(self, audio_url: str) -> Dict[str, Any]:
    """
    Orchestrate the complete audio processing workflow
    """
    job_id = self.request.id
    processor = AudioProcessor()
    
    try:
        processor.publish_progress(job_id, 'workflow', 5, 'Starting audio processing workflow...')
        
        # Step 1: Quick probe
        probe_result = quick_probe.delay(audio_url).get()
        processor.publish_progress(job_id, 'workflow', 20, 'Stream analysis complete')
        
        # Step 2: Low-res peaks (high priority)
        low_peaks_result = low_res_peaks.delay(audio_url, probe_result).get()
        processor.publish_progress(job_id, 'workflow', 40, 'Low-res waveform ready')
        
        # Step 3: Progressive download
        download_result = progressive_download.delay(audio_url, probe_result).get()
        processor.publish_progress(job_id, 'workflow', 70, 'Download complete')
        
        # Step 4: High-res peaks
        high_peaks_result = high_res_peaks.delay(
            download_result['file_path'], 
            download_result['cache_key']
        ).get()
        processor.publish_progress(job_id, 'workflow', 90, 'High-res peaks ready')
        
        # Step 5: Postprocess and cache
        final_result = postprocess_cache.delay(
            download_result['file_path'],
            high_peaks_result,
            download_result['cache_key']
        ).get()
        
        processor.publish_progress(job_id, 'workflow', 100, 'Processing complete!', final_result)
        return final_result
        
    except Exception as e:
        processor.publish_progress(job_id, 'workflow', 0, f'Workflow failed: {str(e)}')
        raise
