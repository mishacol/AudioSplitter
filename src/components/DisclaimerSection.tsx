import React from 'react';

const DisclaimerSection: React.FC = () => {
  return (
    <div className="bg-gray-900 py-16">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-2xl p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L1 21h22L12 2zm0 3.5L19.5 19h-15L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-yellow-400 mb-4">
                  Important Disclaimer
                </h3>
                <p className="text-gray-300 leading-relaxed mb-4">
                  <strong>Disclaimer:</strong> Qronosound is a tool provided for educational and personal use only.
                  Users are solely responsible for ensuring they have the legal right to download, process, and 
                  distribute any audio content. We do not condone or support copyright infringement.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  By using this service, you acknowledge that you have obtained proper permissions for any 
                  copyrighted material and agree to comply with all applicable copyright laws and terms of 
                  service of source platforms.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerSection;