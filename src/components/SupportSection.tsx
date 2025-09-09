import React from 'react';

const SupportSection: React.FC = () => {
  return (
    <div className="bg-gray-800 py-16">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Support Box */}
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-700">
            <h3 className="text-2xl font-bold text-white mb-4">
              Support Our Project
            </h3>
            <p className="text-gray-300 mb-6">
              Help us keep QronoSound free and running with a small donation
            </p>
            <a 
              href="https://www.paypal.com/donate" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 w-full block text-center"
            >
              Donate via PayPal
            </a>
          </div>

          {/* Other Services Box */}
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-700">
            <h3 className="text-2xl font-bold text-white mb-4">
              Check Our Other Services
            </h3>
            <p className="text-gray-300 mb-6">
              Discover more tools and professional services
            </p>
            <button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 w-full">
              Explore Services
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportSection;