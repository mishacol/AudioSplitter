import React, { useEffect, useRef } from 'react';

interface AdContainerProps {
  slot?: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  className?: string;
}

const AdContainer: React.FC<AdContainerProps> = ({ 
  slot = '1234567890', 
  format = 'auto',
  className = '' 
}) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Simulate ad loading with placeholder
    if (adRef.current) {
      // In real implementation, this would be:
      // (window.adsbygoogle = window.adsbygoogle || []).push({});
    }
  }, []);

  return (
    <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 ${className}`}>
      <div className="text-xs text-gray-500 mb-2 text-center">Advertisement</div>
      <div 
        ref={adRef}
        className="bg-gray-700 rounded h-32 flex items-center justify-center"
        data-ad-client="ca-pub-xxxxxxxxxxxxxxxx"
        data-ad-slot={slot}
        data-ad-format={format}
      >
        <span className="text-gray-400 text-sm">Ad Space</span>
      </div>
    </div>
  );
};

export default AdContainer;