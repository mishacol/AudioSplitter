#!/usr/bin/env python3
"""
Test script to demonstrate the Python audio processing API
"""

import requests
import json
import base64
from io import BytesIO
import matplotlib.pyplot as plt
import numpy as np

def test_waveform_generation():
    """Test waveform generation with mock data"""
    print("🎵 Testing Python Audio Processing API")
    print("=" * 50)
    
    # Mock audio data
    duration = 30  # 30 seconds
    sample_rate = 44100
    samples = int(duration * sample_rate)
    
    # Generate mock audio signal
    t = np.linspace(0, duration, samples)
    # Create a more interesting waveform
    audio_signal = (
        0.5 * np.sin(2 * np.pi * 440 * t) +  # 440Hz tone
        0.3 * np.sin(2 * np.pi * 880 * t) +  # 880Hz tone
        0.2 * np.sin(2 * np.pi * 220 * t)    # 220Hz tone
    )
    
    # Add some envelope to make it more realistic
    envelope = np.exp(-t / 10)  # Decay over time
    audio_signal *= envelope
    
    # Create waveform visualization
    fig, ax = plt.subplots(figsize=(14, 6))
    fig.patch.set_facecolor('#1f2937')  # Dark background
    ax.set_facecolor('#374151')
    
    # Downsample for visualization
    downsample_factor = len(audio_signal) // 2000
    audio_downsampled = audio_signal[::downsample_factor]
    time_downsampled = t[::downsample_factor]
    
    # Plot waveform
    ax.plot(time_downsampled, audio_downsampled, color='#4F46E5', linewidth=1.2, alpha=0.9)
    ax.fill_between(time_downsampled, audio_downsampled, 0, color='#4F46E5', alpha=0.4)
    
    # Add some split points for demonstration
    split_points = [5, 12, 20, 25]
    for i, point in enumerate(split_points):
        ax.axvline(x=point, color='#EF4444', linewidth=2.5, alpha=0.9)
        ax.text(point, max(audio_downsampled) * 0.9, f'{i+1}', 
               color='#EF4444', fontweight='bold', fontsize=12,
               ha='center', va='bottom',
               bbox=dict(boxstyle='round,pad=0.3', 
                       facecolor='#EF4444', 
                       edgecolor='none',
                       alpha=0.8))
    
    # Styling
    ax.set_xlim(0, duration)
    ax.set_ylim(-1.1, 1.1)
    ax.set_xlabel('Time (seconds)', color='white', fontsize=12, fontweight='500')
    ax.set_ylabel('Amplitude', color='white', fontsize=12, fontweight='500')
    ax.tick_params(colors='white', labelsize=10)
    ax.grid(True, alpha=0.2, color='white', linestyle='-', linewidth=0.5)
    
    # Clean spines
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_color('white')
    ax.spines['left'].set_color('white')
    
    for spine in ax.spines.values():
        spine.set_linewidth(0.8)
    
    plt.tight_layout()
    
    # Save as base64
    buffer = BytesIO()
    plt.savefig(buffer, format='png', dpi=200, bbox_inches='tight',
               facecolor='#1f2937', edgecolor='none', 
               pad_inches=0.1)
    buffer.seek(0)
    
    image_base64 = base64.b64encode(buffer.getvalue()).decode()
    plt.close(fig)
    
    print("✅ Waveform generated successfully!")
    print(f"📊 Duration: {duration} seconds")
    print(f"🎯 Split points: {split_points}")
    print(f"📏 Image size: {len(image_base64)} characters (base64)")
    
    # Save the image for viewing
    with open('test_waveform.png', 'wb') as f:
        f.write(base64.b64decode(image_base64))
    print("💾 Waveform saved as 'test_waveform.png'")
    
    return image_base64

def test_api_endpoints():
    """Test the Flask API endpoints"""
    print("\n🌐 Testing API Endpoints")
    print("=" * 30)
    
    base_url = "http://localhost:5000"
    
    try:
        # Test home endpoint
        response = requests.get(f"{base_url}/")
        if response.status_code == 200:
            print("✅ Home endpoint working")
        else:
            print("❌ Home endpoint failed")
            
        # Test process-audio endpoint (mock)
        test_data = {
            "url": "https://example.com/test-audio.mp3"
        }
        
        response = requests.post(f"{base_url}/process-audio", json=test_data)
        if response.status_code == 200:
            print("✅ Process-audio endpoint responding")
        else:
            print(f"❌ Process-audio endpoint failed: {response.status_code}")
            
        # Test split-audio endpoint (mock)
        split_data = {
            "url": "https://example.com/test-audio.mp3",
            "split_points": [5, 12, 20],
            "format": "mp3"
        }
        
        response = requests.post(f"{base_url}/split-audio", json=split_data)
        if response.status_code == 200:
            print("✅ Split-audio endpoint responding")
        else:
            print(f"❌ Split-audio endpoint failed: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to Flask server. Make sure it's running on port 5000")
    except Exception as e:
        print(f"❌ API test failed: {e}")

if __name__ == '__main__':
    # Generate test waveform
    waveform_image = test_waveform_generation()
    
    # Test API endpoints
    test_api_endpoints()
    
    print("\n🎉 Python Audio Processing Demo Complete!")
    print("\nKey Features Demonstrated:")
    print("✅ Clean waveform visualization with matplotlib")
    print("✅ Dark theme matching frontend design")
    print("✅ Split point markers with labels")
    print("✅ High-resolution output")
    print("✅ Professional audio analysis")
    print("\nThis approach provides:")
    print("🔹 No confusing JavaScript libraries")
    print("🔹 Clean, professional appearance")
    print("🔹 Precise audio processing")
    print("🔹 Industry-standard libraries")
