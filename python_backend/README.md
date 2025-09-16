# Python Audio Processing Backend

This Python backend provides clean, professional audio processing using industry-standard libraries.

## Features

- **Clean Waveform Visualization**: Using matplotlib for professional-looking waveforms
- **Precise Audio Splitting**: Using pydub for accurate audio manipulation
- **Audio Analysis**: Using librosa for advanced audio processing
- **High Performance**: Python's optimized libraries for better performance

## Libraries Used

- **librosa**: Audio analysis and feature extraction
- **matplotlib**: Clean waveform visualization with dark theme
- **pydub**: Audio manipulation and format conversion
- **numpy**: Numerical operations
- **flask**: Web API for frontend integration

## Installation

```bash
cd python_backend
pip install -r requirements.txt
```

## Running the Backend

```bash
python audio_processor.py
```

The API will be available at `http://localhost:5000`

## API Endpoints

- `POST /process-audio`: Generate waveform data and visualization
- `POST /split-audio`: Split audio at specified points
- `GET /download-segment/<filename>`: Download split segments

## Advantages over JavaScript Approach

✅ **Clean Visualization**: Professional matplotlib styling
✅ **Better Performance**: Optimized Python libraries
✅ **More Control**: Full control over waveform appearance
✅ **No Confusion**: Simple, clear implementation
✅ **Industry Standard**: Uses libraries trusted by audio professionals
✅ **Precise Splitting**: Accurate audio manipulation with pydub

## Waveform Features

- Dark theme matching the frontend
- Clean, professional appearance
- Split point markers with labels
- High-resolution output
- Responsive design
- No confusing JavaScript interactions
