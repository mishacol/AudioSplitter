#!/usr/bin/env python3
"""
Audio processing backend using Python libraries for clean waveform generation
and precise audio splitting.
"""

import os
import sys
import json
import librosa
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.backends.backend_agg import FigureCanvasAgg
import io
import base64
from pydub import AudioSegment
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import tempfile
import uuid
import yt_dlp

app = Flask(__name__)
CORS(app)

class AudioProcessor:
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
        
    def download_audio(self, url):
        """Download audio from URL using yt-dlp"""
        try:
            ydl_opts = {
                'format': 'bestaudio/best',
                'outtmpl': os.path.join(self.temp_dir, '%(title)s.%(ext)s'),
                'extractaudio': True,
                'audioformat': 'mp3',
                'noplaylist': True,
            }
            
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                # Convert to mp3 if needed
                if not filename.endswith('.mp3'):
                    audio = AudioSegment.from_file(filename)
                    mp3_filename = filename.rsplit('.', 1)[0] + '.mp3'
                    audio.export(mp3_filename, format='mp3')
                    os.remove(filename)  # Remove original file
                    filename = mp3_filename
                
                return filename, info.get('duration', 0)
                
        except Exception as e:
            print(f"Download error: {e}")
            return None, 0
        
    def generate_waveform_data(self, audio_file_path):
        """Generate clean waveform data for visualization"""
        try:
            # Load audio file
            y, sr = librosa.load(audio_file_path, sr=None)
            duration = len(y) / sr
            
            # Generate waveform data
            times = np.linspace(0, duration, len(y))
            
            # Downsample for visualization (reduce data points)
            downsample_factor = max(1, len(y) // 2000)  # Max 2000 points
            y_downsampled = y[::downsample_factor]
            times_downsampled = times[::downsample_factor]
            
            return {
                'times': times_downsampled.tolist(),
                'amplitudes': y_downsampled.tolist(),
                'duration': duration,
                'sample_rate': sr,
                'original_length': len(y)
            }
        except Exception as e:
            print(f"Error generating waveform data: {e}")
            return None
    
    def create_waveform_image(self, audio_file_path, split_points=None):
        """Create a clean waveform visualization image"""
        try:
            # Load audio
            y, sr = librosa.load(audio_file_path, sr=None)
            duration = len(y) / sr
            
            # Create figure
            fig, ax = plt.subplots(figsize=(12, 4))
            fig.patch.set_facecolor('#1f2937')  # Dark background
            ax.set_facecolor('#374151')
            
            # Generate waveform
            times = np.linspace(0, duration, len(y))
            
            # Plot waveform
            ax.plot(times, y, color='#4F46E5', linewidth=0.8, alpha=0.8)
            ax.fill_between(times, y, 0, color='#4F46E5', alpha=0.3)
            
            # Add split points if provided
            if split_points:
                for i, point in enumerate(split_points):
                    if 0 <= point <= duration:
                        ax.axvline(x=point, color='#EF4444', linewidth=2, alpha=0.8)
                        ax.text(point, max(y) * 0.8, f'{i+1}', 
                               color='#EF4444', fontweight='bold', fontsize=10,
                               ha='center', va='bottom')
            
            # Styling
            ax.set_xlim(0, duration)
            ax.set_ylim(-1, 1)
            ax.set_xlabel('Time (seconds)', color='white')
            ax.set_ylabel('Amplitude', color='white')
            ax.tick_params(colors='white')
            ax.grid(True, alpha=0.3, color='white')
            
            # Remove top and right spines
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['bottom'].set_color('white')
            ax.spines['left'].set_color('white')
            
            plt.tight_layout()
            
            # Convert to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight',
                       facecolor='#1f2937', edgecolor='none')
            buffer.seek(0)
            
            # Encode as base64
            image_base64 = base64.b64encode(buffer.getvalue()).decode()
            plt.close(fig)
            
            return f"data:image/png;base64,{image_base64}"
            
        except Exception as e:
            print(f"Error creating waveform image: {e}")
            return None
    
    def split_audio(self, audio_file_path, split_points, output_format='mp3'):
        """Split audio at specified points"""
        try:
            # Load audio
            audio = AudioSegment.from_file(audio_file_path)
            duration_ms = len(audio)
            
            # Convert split points to milliseconds
            split_points_ms = [int(point * 1000) for point in split_points if 0 <= point <= duration_ms/1000]
            
            segments = []
            temp_files = []
            
            # Create segments
            start = 0
            for i, end_ms in enumerate(split_points_ms + [duration_ms]):
                if start < end_ms:
                    segment = audio[start:end_ms]
                    
                    # Save segment
                    temp_file = os.path.join(self.temp_dir, f"segment_{uuid.uuid4()}.{output_format}")
                    segment.export(temp_file, format=output_format)
                    temp_files.append(temp_file)
                    
                    segments.append({
                        'index': i + 1,
                        'start_time': start / 1000,
                        'end_time': end_ms / 1000,
                        'duration': (end_ms - start) / 1000,
                        'filename': f"segment_{i + 1}.{output_format}",
                        'temp_path': temp_file
                    })
                
                start = end_ms
            
            return segments, temp_files
            
        except Exception as e:
            print(f"Error splitting audio: {e}")
            return None, None

# Initialize processor
processor = AudioProcessor()

@app.route('/')
def home():
    return jsonify({'message': 'Python Audio Processor API'})

@app.route('/process-audio', methods=['POST'])
def process_audio():
    """Process audio file and return waveform data"""
    try:
        data = request.get_json()
        audio_url = data.get('url')
        
        if not audio_url:
            return jsonify({'error': 'No audio URL provided'}), 400
        
        # Download audio file using yt-dlp
        print(f"Downloading audio from: {audio_url}")
        temp_file, duration = processor.download_audio(audio_url)
        
        if not temp_file:
            return jsonify({'error': 'Failed to download audio'}), 500
        
        print(f"Audio downloaded to: {temp_file}")
        
        # Generate waveform data
        waveform_data = processor.generate_waveform_data(temp_file)
        waveform_image = processor.create_waveform_image(temp_file)
        
        if waveform_data and waveform_image:
            return jsonify({
                'success': True,
                'waveform_data': waveform_data,
                'waveform_image': waveform_image,
                'duration': duration,
                'file_path': temp_file
            })
        else:
            return jsonify({'error': 'Failed to process audio'}), 500
            
    except Exception as e:
        print(f"Process audio error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/split-audio', methods=['POST'])
def split_audio():
    """Split audio at specified points"""
    try:
        data = request.get_json()
        audio_url = data.get('url')
        split_points = data.get('split_points', [])
        format = data.get('format', 'mp3')
        
        if not audio_url or not split_points:
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Download audio file (simplified)
        temp_file = os.path.join(processor.temp_dir, f"audio_{uuid.uuid4()}.mp3")
        
        # Split audio
        segments, temp_files = processor.split_audio(temp_file, split_points, format)
        
        if segments:
            return jsonify({
                'success': True,
                'segments': segments
            })
        else:
            return jsonify({'error': 'Failed to split audio'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/download-segment/<path:filename>')
def download_segment(filename):
    """Download a specific segment"""
    try:
        # In production, implement proper file serving
        return jsonify({'error': 'Download not implemented yet'}), 501
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
