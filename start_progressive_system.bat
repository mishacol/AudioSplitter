@echo off
echo 🚀 Starting Progressive Waveform Audio Processor...
echo ================================================

cd python_backend

echo 📦 Installing dependencies...
pip install librosa numpy requests flask flask-cors yt-dlp

echo 🌐 Starting Progressive Audio Processor...
start /B python progressive_audio_processor.py

echo ================================================
echo 🎉 Progressive Audio Processor Started!
echo 📡 Progressive API: http://localhost:5002
echo ⚡ Target: <10s UX with immediate low-res display
echo 🔥 Multi-resolution peaks: overview → zoom_1 → zoom_2 → zoom_3 → zoom_4 → zoom_5
echo ================================================
echo 💡 Press any key to stop the service

pause

echo 🛑 Stopping service...
taskkill /F /IM python.exe 2>nul

echo ✅ Service stopped
