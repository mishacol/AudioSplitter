import React from 'react';
import AdContainer from './AdContainer';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 py-12">
      <div className="container mx-auto px-6">
        <div className="mb-12">
          <AdContainer className="max-w-2xl mx-auto" />
        </div>
        
        {/* Simple Footer Menu */}
        <div className="flex justify-center items-center gap-8 mb-8">
          <a 
            href="/contact" 
            className="text-gray-400 hover:text-white transition-colors duration-300"
          >
            Contact us
          </a>
          <a 
            href="/copyright" 
            className="text-gray-400 hover:text-white transition-colors duration-300"
          >
            Copyright policy
          </a>
          <a 
            href="/blog" 
            className="text-gray-400 hover:text-white transition-colors duration-300"
          >
            Blog
          </a>
        </div>
        
        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-gray-400">
            © 2024 QronoSound. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;