import React from 'react';

const HeroSection: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 overflow-hidden pt-16">
      {/* Animated background */}
      <div className="absolute inset-0 opacity-20">
        <img 
          src="https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360817366_a5a1c9ff.webp"
          alt="Audio waveform background"
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-8xl font-bold text-white mb-6 tracking-tight">
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              QronoSound
            </span>
          </h1>
          
          <h2 className="text-2xl md:text-4xl font-semibold text-gray-200 mb-8">
            Split Any Audio Track with AI Precision
          </h2>
          
          <p className="text-lg md:text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
            Professional audio splitting service powered by AI. Extract individual tracks from mixes, sets, and albums with unmatched precision.
          </p>
          
          <div className="flex justify-center">
            <button 
              onClick={() => document.getElementById('audio-processor')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-8 rounded-lg text-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              Start Splitting Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;