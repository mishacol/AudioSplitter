import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useIsMobile } from '@/hooks/use-mobile';
import Navigation from './Navigation';
import HeroSection from './HeroSection';
import AudioProcessor from './AudioProcessor';
import FeatureGrid from './FeatureGrid';
import AudioPlayer from './AudioPlayer';
import SupportSection from './SupportSection';
import DisclaimerSection from './DisclaimerSection';
import Footer from './Footer';
import AdContainer from './AdContainer';

const AppLayout: React.FC = () => {
  const { sidebarOpen, toggleSidebar } = useAppContext();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-gray-900">
      <Navigation />
      <HeroSection />
      
      {/* Side Ad */}
      <div className="hidden lg:block fixed right-4 top-1/2 transform -translate-y-1/2 z-40">
        <AdContainer format="vertical" className="w-32" />
      </div>
      
      <AudioProcessor />
      <FeatureGrid />
      <AudioPlayer />
      
      {/* Mobile Ad */}
      <div className="lg:hidden py-8">
        <div className="container mx-auto px-6">
          <AdContainer />
        </div>
      </div>
      
      <SupportSection />
      <DisclaimerSection />
      <Footer />
    </div>
  );
};

export default AppLayout;
