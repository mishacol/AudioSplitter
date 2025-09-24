import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';

interface WaveformProps {
  audioUrl: string;
  lowResJsonUrl: string;
  highResJsonUrl: string;
  onReady?: () => void;
}

const ProgressiveWaveform: React.FC<WaveformProps> = ({
  audioUrl,
  lowResJsonUrl,
  highResJsonUrl,
  onReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [app, setApp] = useState<PIXI.Application>();
  const [lowResPeaks, setLowResPeaks] = useState<number[]>([]);
  const [highResPeaks, setHighResPeaks] = useState<number[]>([]);
  const [playhead, setPlayhead] = useState<number>(0);

  useEffect(() => {
    const loadPeaks = async () => {
      try {
        const low = await fetch(lowResJsonUrl).then((r) => r.json());
        const lowArr = Array.isArray(low) ? low : low.peaks || [];
        setLowResPeaks(lowArr);
        onReady?.();
        fetch(highResJsonUrl)
          .then((r) => r.json())
          .then((hi) => setHighResPeaks(Array.isArray(hi) ? hi : hi.peaks || []))
          .catch(() => {});
      } catch (e) {
        // ignore
      }
    };
    loadPeaks();
  }, [lowResJsonUrl, highResJsonUrl, onReady]);

  useEffect(() => {
    if (!containerRef.current) return;
    const pixi = new PIXI.Application({
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      backgroundAlpha: 0,
      antialias: true,
    });
    containerRef.current.appendChild(pixi.view as unknown as Node);
    setApp(pixi);
    return () => pixi.destroy(true, { children: true });
  }, []);

  useEffect(() => {
    if (!app || lowResPeaks.length === 0) return;
    const gfx = new PIXI.Graphics();
    app.stage.removeChildren();
    app.stage.addChild(gfx);
    const width = app.view.width;
    const height = app.view.height;
    const peaks = highResPeaks.length ? highResPeaks : lowResPeaks;
    const step = Math.max(1, width / peaks.length);
    gfx.lineStyle(1, 0xffffff, 1);
    gfx.moveTo(0, height / 2);
    for (let i = 0; i < peaks.length; i++) {
      const v = Math.max(0, Math.min(1, peaks[i] || 0));
      const y = height / 2 - v * (height / 2 - 2);
      gfx.lineTo(i * step, y);
    }
    gfx.lineTo(width, height / 2);
  }, [app, lowResPeaks, highResPeaks]);

  useEffect(() => {
    if (!app) return;
    const line = new PIXI.Graphics();
    app.stage.addChild(line);
    const ticker = new PIXI.Ticker();
    ticker.add(() => {
      const w = app.view.width;
      const h = app.view.height;
      line.clear();
      line.lineStyle(2, 0xff3b81, 1);
      line.moveTo(playhead * w, 0);
      line.lineTo(playhead * w, h);
    });
    ticker.start();
    return () => ticker.destroy();
  }, [app, playhead]);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    const onUpdate = () => {
      if (!isFinite(audio.duration) || audio.duration <= 0) return;
      setPlayhead(audio.currentTime / audio.duration);
    };
    audio.addEventListener('timeupdate', onUpdate);
    return () => audio.removeEventListener('timeupdate', onUpdate);
  }, [audioUrl]);

  return <div ref={containerRef} style={{ width: '100%', height: 150 }} />;
};

export default ProgressiveWaveform;


