import React, { useState } from 'react';

const Navigation: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const scrollToProcessor = () => {
    document.getElementById('audio-processor')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              QronoSound
            </span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#support" className="text-gray-300 hover:text-white transition-colors">
              Support
            </a>
            <button 
              onClick={scrollToProcessor}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-all duration-300"
            >
              Get Started
            </button>
          </div>
          
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        
        {isOpen && (
          <div className="md:hidden py-4 border-t border-gray-800">
            <div className="flex flex-col space-y-4">
              <a href="#support" className="text-gray-300 hover:text-white transition-colors">
                Support
              </a>
              <button 
                onClick={scrollToProcessor}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold py-2 px-6 rounded-lg w-full"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;