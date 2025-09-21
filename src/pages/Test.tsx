import React from 'react';

const Test: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-4xl font-bold mb-4">Test Page</h1>
      <p className="text-gray-300">If you can see this, React is working!</p>
      
      <div className="mt-8 p-4 bg-gray-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Waveform Editor Test</h2>
        <p className="text-gray-400">This page is for testing the new waveform editor.</p>
      </div>
    </div>
  );
};

export default Test;
