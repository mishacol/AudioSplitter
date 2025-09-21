import React, { useEffect, useRef, useState } from 'react';
import Peaks from 'peaks.js';

type Props = {
  audioUrl: string;
};

const Waveform: React.FC<Props> = ({ audioUrl }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const overviewContainerRef = useRef<HTMLDivElement | null>(null);
  const zoomviewContainerRef = useRef<HTMLDivElement | null>(null);
  const [isPeaksReady, setIsPeaksReady] = useState(false);

  // Проверяем готовность DOM элементов
  useEffect(() => {
    if (audioRef.current && overviewContainerRef.current && zoomviewContainerRef.current) {
      setIsPeaksReady(true);
    } else {
      setIsPeaksReady(false);
    }
  }, [audioUrl]);

  // Инициализируем Peaks.js только когда все готово
  useEffect(() => {
    if (!isPeaksReady) {
      console.log('Peaks.js refs not yet ready.');
      return;
    }

    console.log('Initializing Peaks.js...');
    console.log('Audio element:', audioRef.current);
    console.log('Overview container:', overviewContainerRef.current);
    console.log('Zoomview container:', zoomviewContainerRef.current);

    const options = {
      zoomview: {
        container: zoomviewContainerRef.current!
      },
      overview: {
        container: overviewContainerRef.current!
      },
      mediaElement: audioRef.current!,
      webAudio: {
        audioContext: new (window.AudioContext || (window as any).webkitAudioContext)(),
      },
    };

    Peaks.init(options, (err, peaks) => {
      if (err) {
        console.error('Peaks init error:', err);
        return;
      }

      console.log('Peaks.js initialized successfully!');
      
      // Добавляем кастомный курсор (пример)
      peaks.views.getView('overview').enableSeek(true);

      // Можно подписаться на события (например, перемещение курсора)
      peaks.on('player.seeked', (time: number) => {
        console.log('Cursor moved to', time);
      });
    });

    return () => {
      // cleanup при размонтировании
      // Peaks.js автоматически очищается при размонтировании компонента
    };
  }, [isPeaksReady, audioUrl]);

  return (
    <div className="space-y-4">
      {/* Zoomview */}
      <div className="bg-gray-700 rounded p-2">
        <div ref={zoomviewContainerRef} style={{ width: '100%', height: '100px' }} />
      </div>
      
      {/* Overview */}
      <div className="bg-gray-700 rounded p-2">
        <div ref={overviewContainerRef} style={{ width: '100%', height: '150px' }} />
      </div>
      
      {/* Audio element */}
      <audio ref={audioRef} src={audioUrl} controls className="w-full" />
    </div>
  );
};

export default Waveform;
