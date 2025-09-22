"""
Celery configuration for async audio processing pipeline
"""
import os
from celery import Celery

# Redis configuration
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# Create Celery instance
celery_app = Celery(
    'audio_processor',
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['audio_tasks']
)

# Celery configuration
celery_app.conf.update(
    # Task routing
    task_routes={
        'audio_tasks.*': {'queue': 'audio_processing'},
    },
    
    # Task execution
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    
    # Task timeouts
    task_soft_time_limit=300,  # 5 minutes soft limit
    task_time_limit=600,        # 10 minutes hard limit
    
    # Worker configuration
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
    
    # Result backend
    result_expires=3600,  # 1 hour
    
    # Task retry configuration
    task_acks_late=True,
    worker_disable_rate_limits=True,
    
    # Progress tracking
    task_track_started=True,
    task_send_sent_event=True,
)

# Task priority levels
CELERY_TASK_PRIORITIES = {
    'quick_probe': 9,      # Highest priority
    'low_res_peaks': 8,    # High priority
    'progressive_download': 5,  # Medium priority
    'high_res_peaks': 3,    # Lower priority
    'postprocess_cache': 1,  # Lowest priority
}
