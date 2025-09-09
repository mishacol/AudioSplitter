import React from 'react';

const features = [
  {
    icon: "https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360818134_6914e400.webp",
    title: "AI-Powered Splitting",
    description: "Advanced machine learning algorithms automatically detect and separate individual tracks"
  },
  {
    icon: "https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360818852_2e5a8e70.webp",
    title: "Professional Quality",
    description: "Studio-grade audio processing maintains original quality throughout the splitting process"
  },
  {
    icon: "https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360819683_26868419.webp",
    title: "Multiple Formats",
    description: "Export in MP3, WAV, FLAC, and other popular audio formats for maximum compatibility"
  }
];

const FeatureGrid: React.FC = () => {
  return (
    <div className="bg-gray-800 py-20">
      <div className="container mx-auto px-6">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          Why Choose Qronosound?
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-blue-500/50 transition-all duration-300 group"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full overflow-hidden">
                <img
                  src={feature.icon}
                  alt={feature.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
              </div>
              <h3 className="text-xl font-semibold text-white text-center mb-4">
                {feature.title}
              </h3>
              <p className="text-gray-300 text-center leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeatureGrid;