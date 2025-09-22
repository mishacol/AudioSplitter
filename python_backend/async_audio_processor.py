"""
Async Flask app with Celery integration for audio processing
"""
import os
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any

import redis
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from celery_config import celery_app, REDIS_URL
from audio_tasks import process_audio_workflow, quick_probe, low_res_peaks

app = Flask(__name__)
CORS(app, origins=['http://localhost:8080', 'http://localhost:8081', 'http://localhost:3000'])

# Redis client for progress events
redis_client = redis.from_url(REDIS_URL)

# Global job tracking
job_status = {}
job_lock = {}

def update_job_status(job_id: str, status: str, progress: int, message: str, data: Dict = None):
    """Update job status in memory and Redis"""
    job_status[job_id] = {
        'status': status,
        'progress': progress,
        'message': message,
        'data': data or {},
        'timestamp': datetime.utcnow().isoformat()
    }

@app.route('/preload', methods=['POST'])
def preload_audio():
    """Start async audio processing workflow"""
    try:
        data = request.get_json()
        audio_url = data.get('url')
        
        if not audio_url:
            return jsonify({'error': 'URL required'}), 400
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        
        # Start async workflow
        task = process_audio_workflow.delay(audio_url)
        
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
        pubsub = redis_client.pubsub()
        pubsub.subscribe(f'audio_progress:{job_id}')
        
        try:
            for message in pubsub.listen():
                if message['type'] == 'message':
                    yield f"data: {message['data'].decode('utf-8')}\n\n"
                    
                    # Update local job status
                    try:
                        event_data = json.loads(message['data'])
                        update_job_status(
                            job_id,
                            event_data.get('stage', 'processing'),
                            event_data.get('progress', 0),
                            event_data.get('message', ''),
                            event_data.get('data', {})
                        )
                    except:
                        pass
                        
        except GeneratorExit:
            pubsub.close()
    
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
        
        # Check if high-res peaks are ready
        if 'peaks_data' in job_data.get('data', {}):
            return jsonify(job_status[job_id]['data']['peaks_data'])
        
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
            if os.path.exists(file_path):
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
        
        # Security: only allow files from cache directory
        file_path = os.path.join('cache', filename)
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
        'redis_connected': redis_client.ping(),
        'celery_workers': len(celery_app.control.inspect().active())
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
    os.makedirs('cache', exist_ok=True)
    os.makedirs('downloads', exist_ok=True)
    
    print("🚀 Starting Async Audio Processor...")
    print("📡 Redis URL:", REDIS_URL)
    print("🔧 Celery Broker:", celery_app.conf.broker_url)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
