@echo off
echo 🚀 Starting Async Audio Processing System...
echo ================================================

cd python_backend

echo 📦 Installing dependencies...
pip install -r requirements_async.txt

echo 🔴 Starting Redis (if available)...
start /B redis-server

echo 🔧 Starting Celery Worker...
start /B python start_worker.py

echo 🌐 Starting Flask App...
start /B python async_audio_processor.py

echo ================================================
echo 🎉 Async Audio Processing System Started!
echo 📡 Flask API: http://localhost:5000
echo 🔧 Celery Worker: Running
echo 🔴 Redis: Running
echo ================================================
echo 💡 Press any key to stop all services

pause

echo 🛑 Stopping services...
taskkill /F /IM redis-server.exe 2>nul
taskkill /F /IM python.exe 2>nul

echo ✅ All services stopped
