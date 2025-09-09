import React from 'react';
import AdContainer from './AdContainer';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 border-t border-gray-800 py-12">
      <div className="container mx-auto px-6">
        <div className="mb-12">
          <AdContainer className="max-w-2xl mx-auto" />
        </div>
        
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold text-white mb-4">QronoSound</h3>
            <p className="text-gray-400">
              Professional audio splitting service powered by AI technology.
            </p>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Features</h4>
            <ul className="space-y-2 text-gray-400">
              <li>AI-Powered Splitting</li>
              <li>Manual Control</li>
              <li>Multiple Formats</li>
              <li>Batch Processing</li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-2 text-gray-400">
              <li>Contact Us</li>
              <li>Help Center</li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-gray-400">
              <li>Copyright Policy</li>
              <li>Blog</li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-800 mt-8 pt-8 text-center">
          <p className="text-gray-400">
            © 2024 QronoSound. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;