"""
Start Celery worker for audio processing tasks
"""
import os
import sys
from celery_config import celery_app

if __name__ == '__main__':
    print("🔧 Starting Celery Worker for Audio Processing...")
    print("📡 Redis URL:", os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
    
    # Start worker with specific configuration
    celery_app.worker_main([
        'worker',
        '--loglevel=info',
        '--concurrency=2',  # Limit concurrency for audio processing
        '--queues=audio_processing',
        '--hostname=audio_worker@%h',
        '--without-gossip',
        '--without-mingle',
        '--without-heartbeat'
    ])
