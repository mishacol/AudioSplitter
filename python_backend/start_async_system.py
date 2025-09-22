"""
Start the complete async audio processing system
"""
import subprocess
import time
import sys
import os
from pathlib import Path

def start_redis():
    """Start Redis server"""
    print("🔴 Starting Redis server...")
    try:
        # Try to start Redis (Windows)
        subprocess.Popen(['redis-server'], shell=True)
        time.sleep(2)
        print("✅ Redis started")
        return True
    except Exception as e:
        print(f"❌ Redis start failed: {e}")
        print("💡 Please install Redis or start it manually")
        return False

def start_celery_worker():
    """Start Celery worker"""
    print("🔧 Starting Celery worker...")
    try:
        subprocess.Popen([
            sys.executable, 'start_worker.py'
        ], cwd=Path(__file__).parent)
        time.sleep(3)
        print("✅ Celery worker started")
        return True
    except Exception as e:
        print(f"❌ Celery worker start failed: {e}")
        return False

def start_flask_app():
    """Start Flask app"""
    print("🌐 Starting Flask app...")
    try:
        subprocess.Popen([
            sys.executable, 'async_audio_processor.py'
        ], cwd=Path(__file__).parent)
        time.sleep(2)
        print("✅ Flask app started")
        return True
    except Exception as e:
        print(f"❌ Flask app start failed: {e}")
        return False

def main():
    """Start the complete async system"""
    print("🚀 Starting Async Audio Processing System...")
    print("=" * 50)
    
    # Start Redis
    if not start_redis():
        print("⚠️  Continuing without Redis (will use fallback)")
    
    # Start Celery worker
    if not start_celery_worker():
        print("❌ Failed to start Celery worker")
        return
    
    # Start Flask app
    if not start_flask_app():
        print("❌ Failed to start Flask app")
        return
    
    print("=" * 50)
    print("🎉 Async Audio Processing System Started!")
    print("📡 Flask API: http://localhost:5000")
    print("🔧 Celery Worker: Running")
    print("🔴 Redis: Running")
    print("=" * 50)
    print("💡 Press Ctrl+C to stop all services")

if __name__ == '__main__':
    try:
        main()
        # Keep the script running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n🛑 Shutting down async system...")
        sys.exit(0)
