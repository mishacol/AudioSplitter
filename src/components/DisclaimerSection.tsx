import React from 'react';

const DisclaimerSection: React.FC = () => {
  return (
    <div className="bg-gray-800 py-16">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gray-900 rounded-2xl p-8 border border-yellow-600">
            {/* Centered header with warning icon */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="text-yellow-500">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-yellow-500">Important Disclaimer</h2>
            </div>
            
            {/* Disclaimer content */}
            <div className="space-y-4 text-gray-300">
              <p>
                <span className="font-semibold text-white"></span> Qronosound is a tool provided for educational and personal use only. Users are solely responsible for ensuring they have the legal right to download, process, and distribute any audio content. We do not condone or support copyright infringement.
              </p>
              
              <p>
                By using this service, you acknowledge that you have obtained proper permissions for any copyrighted material and agree to comply with all applicable copyright laws and terms of service of source platforms.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerSection;