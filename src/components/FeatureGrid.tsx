import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const blogArticles = [
  {
    title: "How AI Revolutionizes Audio Splitting",
    excerpt: "Discover the cutting-edge technologies behind modern audio separation and how machine learning transforms music production.",
    image: "https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360818134_6914e400.webp",
    readTime: "5 min read"
  },
  {
    title: "Professional Audio Editing Tips",
    excerpt: "Learn advanced techniques from industry professionals to enhance your audio splitting and editing workflow.",
    image: "https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360818852_2e5a8e70.webp",
    readTime: "7 min read"
  },
  {
    title: "Understanding Audio Formats: MP3 vs WAV vs FLAC",
    excerpt: "Complete guide to audio formats, quality differences, and when to use each format for your projects.",
    image: "https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360819683_26868419.webp",
    readTime: "4 min read"
  },
  {
    title: "The Future of Audio Processing",
    excerpt: "Exploring emerging trends in audio technology and what the next decade holds for music production.",
    image: "https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360818134_6914e400.webp",
    readTime: "6 min read"
  },
  {
    title: "Mastering Audio Compression Techniques",
    excerpt: "Deep dive into audio compression methods and how they affect the splitting and processing workflow.",
    image: "https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360818852_2e5a8e70.webp",
    readTime: "8 min read"
  },
  {
    title: "Building Your Home Studio Setup",
    excerpt: "Essential equipment and software recommendations for creating professional-quality audio at home.",
    image: "https://d64gsuwffb70l.cloudfront.net/68bf327081eca654cd4e6dde_1757360819683_26868419.webp",
    readTime: "6 min read"
  }
];

const FeatureGrid: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-scroll functionality
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % (blogArticles.length - 2));
    }, 4000); // Change slide every 4 seconds

    return () => clearInterval(interval);
  }, [isPaused]);

  const nextSlide = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + 1) % (blogArticles.length - 2));
    setTimeout(() => setIsAnimating(false), 300);
  };

  const prevSlide = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev - 1 + (blogArticles.length - 2)) % (blogArticles.length - 2));
    setTimeout(() => setIsAnimating(false), 300);
  };

  const goToSlide = (index: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex(index);
    setTimeout(() => setIsAnimating(false), 300);
  };

  const handleArticleClick = () => {
    // Navigate to blog page
    window.location.href = '/blog';
  };

  const visibleArticles = blogArticles.slice(currentIndex, currentIndex + 3);

  return (
    <div 
      className="bg-gray-800 py-20"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container mx-auto px-6">
        <h2 className="text-4xl font-bold text-white text-center mb-16">
          Latest from Our Blog
        </h2>
        
        <div className="max-w-6xl mx-auto">
          {/* Carousel Container */}
          <div className="relative">
            {/* Navigation Arrows */}
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-gray-900/80 hover:bg-gray-900 text-white p-3 rounded-full transition-all duration-300"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-gray-900/80 hover:bg-gray-900 text-white p-3 rounded-full transition-all duration-300"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Three Articles Display */}
            <div className="grid md:grid-cols-3 gap-8">
              {visibleArticles.map((article, index) => (
                <div
                  key={currentIndex + index}
                  className="bg-gray-900 rounded-2xl p-8 border border-gray-700 hover:border-blue-500/50 transition-all duration-300 group cursor-pointer transform hover:scale-105"
                  onClick={handleArticleClick}
                >
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full overflow-hidden">
                    <img
                      src={article.image}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <h3 className="text-xl font-semibold text-white text-center mb-4 group-hover:text-blue-400 transition-colors duration-300">
                    {article.title}
                  </h3>
                  <p className="text-gray-300 text-center leading-relaxed mb-4">
                    {article.excerpt}
                  </p>
                  <div className="text-center">
                    <span className="text-blue-400 text-sm font-medium">
                      {article.readTime}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Carousel Indicators */}
            <div className="flex justify-center mt-8 gap-3">
              {Array.from({ length: blogArticles.length - 2 }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentIndex 
                      ? 'bg-blue-500 w-8' 
                      : 'bg-gray-600 hover:bg-gray-500'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureGrid;