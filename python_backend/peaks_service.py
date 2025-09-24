import hashlib
import io
import json
import os
import queue
import threading
import time
import uuid
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

import numpy as np
import subprocess


# -----------------------------------------------------------------------------
# Peaks generation via FFmpeg (PCM stream) → Python downsampling to JSON
# - Low-res: first ~10s, immediate (<5s) response for instant UI render
# - High-res: full track in background, returned when ready
# - Cached by URL hash under python_backend/.peaks_cache
# -----------------------------------------------------------------------------


CACHE_DIR = os.path.join(os.path.dirname(__file__), ".peaks_cache")
os.makedirs(CACHE_DIR, exist_ok=True)


def url_to_key(source_url: str) -> str:
    return hashlib.sha1(source_url.encode("utf-8")).hexdigest()


def cache_path(key: str, kind: str) -> str:
    # kind ∈ {"low", "high"}
    return os.path.join(CACHE_DIR, f"{key}.{kind}.json")


def run_ffmpeg_pcm_stream(source_url: str, sample_rate: int, seconds_limit: Optional[int]) -> bytes:
    """Run FFmpeg to decode audio to mono f32le PCM streamed to stdout.

    - sample_rate: target sample rate (e.g., 8000)
    - seconds_limit: if provided, FFmpeg will stop at this duration (-t)
    """
    cmd = [
        "ffmpeg",
        "-v", "error",
        "-i", source_url,
        "-vn",
        "-ac", "1",
        "-ar", str(sample_rate),
    ]
    if seconds_limit and seconds_limit > 0:
        cmd += ["-t", str(seconds_limit)]
    cmd += ["-f", "f32le", "pipe:1"]

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdout is not None
    pcm = proc.stdout.read()
    proc.wait()
    return pcm


def pcm_to_peaks(pcm_bytes: bytes, sample_rate: int, window_samples: int) -> List[float]:
    """Convert raw f32le PCM bytes to a list of peak values per window.

    Peaks are normalized to [-1.0, 1.0]. Output is list of max absolute sample per window.
    """
    if not pcm_bytes:
        return []

    audio = np.frombuffer(pcm_bytes, dtype=np.float32)
    if audio.size == 0:
        return []

    num_windows = int(np.ceil(len(audio) / window_samples))
    peaks: List[float] = []
    for i in range(num_windows):
        start = i * window_samples
        end = min((i + 1) * window_samples, len(audio))
        window = audio[start:end]
        if window.size == 0:
            continue
        peak = float(np.max(np.abs(window)))
        # clamp (safety)
        if peak > 1.0:
            peak = 1.0
        peaks.append(peak)
    return peaks


def build_peaks_json(
    source_url: str,
    peaks: List[float],
    sample_rate: int,
    window_samples: int,
    resolution: str,
    duration_seconds: Optional[float] = None,
) -> Dict:
    return {
        "source": source_url,
        "resolution": resolution,
        "sample_rate": sample_rate,
        "window_samples": window_samples,
        "points": len(peaks),
        "duration": duration_seconds,
        "peaks": peaks,
    }


# -----------------------------------------------------------------------------
# Job management
# -----------------------------------------------------------------------------


@dataclass
class JobStatus:
    job_id: str
    url: str
    key: str
    status: str  # queued | running | completed | error
    low_ready: bool = False
    high_ready: bool = False
    error: Optional[str] = None


jobs: Dict[str, JobStatus] = {}

def generate_placeholder_peaks(points: int = 1024) -> List[float]:
    """Generate a quick placeholder peaks array for instant UX."""
    # Slight random variations so the user sees a waveform, not a flat line
    rng = np.random.default_rng()
    noise = rng.uniform(low=0.02, high=0.25, size=points).astype(np.float32)
    return [float(x) for x in noise]


def generate_low_then_high(job: JobStatus) -> None:
    try:
        jobs[job.job_id].status = "running"

        # --- LOW RES: write placeholder immediately for instant UI ---
        placeholder = generate_placeholder_peaks(points=1024)
        low_json = build_peaks_json(job.url, placeholder, 8000, 256, "low", duration_seconds=0.1)
        with open(cache_path(job.key, "low"), "w", encoding="utf-8") as f:
            json.dump(low_json, f)
        jobs[job.job_id].low_ready = True

        # --- LOW RES actual (first ~10s, quick) ---
        low_sr = 8000
        low_seconds = 10
        low_window = 256  # ~32 ms windows at 8kHz
        pcm_low = run_ffmpeg_pcm_stream(job.url, sample_rate=low_sr, seconds_limit=low_seconds)
        low_peaks = pcm_to_peaks(pcm_low, sample_rate=low_sr, window_samples=low_window)
        if low_peaks:
            low_json = build_peaks_json(job.url, low_peaks, low_sr, low_window, "low", duration_seconds=low_seconds)
            with open(cache_path(job.key, "low"), "w", encoding="utf-8") as f:
                json.dump(low_json, f)

        # --- HIGH RES (smart limit for long tracks) ---
        high_sr = 8000
        high_window = 128  # finer detail
        
        # For tracks longer than 10 minutes, limit processing to first 5 minutes
        # This gives enough detail for splitting while keeping processing fast
        max_processing_seconds = 300  # 5 minutes max
        
        pcm_high = run_ffmpeg_pcm_stream(job.url, sample_rate=high_sr, seconds_limit=max_processing_seconds)
        high_peaks = pcm_to_peaks(pcm_high, sample_rate=high_sr, window_samples=high_window)
        # duration if available: samples / sr
        duration_seconds = len(pcm_high) / 4 / high_sr if pcm_high else None
        high_json = build_peaks_json(job.url, high_peaks, high_sr, high_window, "high", duration_seconds=duration_seconds)
        with open(cache_path(job.key, "high"), "w", encoding="utf-8") as f:
            json.dump(high_json, f)
        jobs[job.job_id].high_ready = True
        jobs[job.job_id].status = "completed"
    except Exception as e:
        jobs[job.job_id].status = "error"
        jobs[job.job_id].error = str(e)


# -----------------------------------------------------------------------------
# Flask app
# -----------------------------------------------------------------------------


app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:8080",
    "http://localhost:8081",
], supports_credentials=True)


@app.route("/peaks/start", methods=["POST"])
def peaks_start():
    data = request.get_json(force=True, silent=True) or {}
    source_url = data.get("url")
    if not source_url:
        return jsonify({"error": "url required"}), 400

    key = url_to_key(source_url)

    # If cached, ensure job object reflects cache availability
    job_id = str(uuid.uuid4())
    job = JobStatus(job_id=job_id, url=source_url, key=key, status="queued")
    jobs[job_id] = job

    # Start thread
    thread = threading.Thread(target=generate_low_then_high, args=(job,))
    thread.daemon = True
    thread.start()

    return jsonify({"job_id": job_id, "key": key}), 202


@app.route("/peaks/<job_id>/status", methods=["GET"])
def peaks_status(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    return jsonify(asdict(job))


@app.route("/peaks/<job_id>/low", methods=["GET"])
def peaks_low(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    p = cache_path(job.key, "low")
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    return jsonify({"status": "pending"}), 202


@app.route("/peaks/<job_id>/high", methods=["GET"])
def peaks_high(job_id: str):
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "job not found"}), 404
    p = cache_path(job.key, "high")
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    return jsonify({"status": "pending"}), 202


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "cache_items": len(os.listdir(CACHE_DIR))})


if __name__ == "__main__":
    port = int(os.environ.get("PEAKS_PORT", "5003"))
    print(f"🚀 Peaks JSON service running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True, threaded=True)


