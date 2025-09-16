#!/usr/bin/env python3
"""
Test script for waveform generation
"""

import librosa
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.backends.backend_agg import FigureCanvasAgg
import io
import base64

def create_clean_waveform(audio_file_path):
    """Create a clean, professional waveform visualization"""
    try:
        # Load audio
        y, sr = librosa.load(audio_file_path, sr=None)
        duration = len(y) / sr
        
        # Create figure with dark theme
        fig, ax = plt.subplots(figsize=(14, 6))
        fig.patch.set_facecolor('#1f2937')  # Dark gray background
        ax.set_facecolor('#374151')  # Slightly lighter gray
        
        # Generate time array
        times = np.linspace(0, duration, len(y))
        
        # Plot waveform with gradient effect
        ax.plot(times, y, color='#4F46E5', linewidth=1.2, alpha=0.9)
        ax.fill_between(times, y, 0, color='#4F46E5', alpha=0.4)
        
        # Add subtle grid
        ax.grid(True, alpha=0.2, color='white', linestyle='-', linewidth=0.5)
        
        # Styling
        ax.set_xlim(0, duration)
        ax.set_ylim(-1.1, 1.1)
        ax.set_xlabel('Time (seconds)', color='white', fontsize=12, fontweight='500')
        ax.set_ylabel('Amplitude', color='white', fontsize=12, fontweight='500')
        ax.tick_params(colors='white', labelsize=10)
        
        # Remove top and right spines for cleaner look
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['bottom'].set_color('white')
        ax.spines['left'].set_color('white')
        
        # Add subtle border
        for spine in ax.spines.values():
            spine.set_linewidth(0.8)
        
        plt.tight_layout()
        
        # Save as high-quality image
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=200, bbox_inches='tight',
                   facecolor='#1f2937', edgecolor='none', 
                   pad_inches=0.1)
        buffer.seek(0)
        
        # Convert to base64
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close(fig)
        
        return f"data:image/png;base64,{image_base64}"
        
    except Exception as e:
        print(f"Error creating waveform: {e}")
        return None

def create_waveform_with_markers(audio_file_path, split_points=None):
    """Create waveform with split point markers"""
    try:
        # Load audio
        y, sr = librosa.load(audio_file_path, sr=None)
        duration = len(y) / sr
        
        # Create figure
        fig, ax = plt.subplots(figsize=(14, 6))
        fig.patch.set_facecolor('#1f2937')
        ax.set_facecolor('#374151')
        
        # Generate time array
        times = np.linspace(0, duration, len(y))
        
        # Plot waveform
        ax.plot(times, y, color='#4F46E5', linewidth=1.2, alpha=0.9)
        ax.fill_between(times, y, 0, color='#4F46E5', alpha=0.4)
        
        # Add split point markers
        if split_points:
            for i, point in enumerate(split_points):
                if 0 <= point <= duration:
                    # Vertical line
                    ax.axvline(x=point, color='#EF4444', linewidth=2.5, alpha=0.9)
                    
                    # Marker label
                    ax.text(point, max(y) * 0.9, f'{i+1}', 
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
        
        # Save image
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png', dpi=200, bbox_inches='tight',
                   facecolor='#1f2937', edgecolor='none', 
                   pad_inches=0.1)
        buffer.seek(0)
        
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        plt.close(fig)
        
        return f"data:image/png;base64,{image_base64}"
        
    except Exception as e:
        print(f"Error creating waveform with markers: {e}")
        return None

if __name__ == '__main__':
    # Test with a sample audio file
    print("Python Audio Processing Libraries:")
    print("- librosa: Audio analysis and feature extraction")
    print("- matplotlib: Clean waveform visualization")
    print("- pydub: Audio manipulation and splitting")
    print("- numpy: Numerical operations")
    print("\nThis approach will provide:")
    print("✅ Clean, professional waveform visualization")
    print("✅ Precise audio splitting")
    print("✅ Better performance")
    print("✅ More control over styling")
    print("✅ No confusing JavaScript libraries")
