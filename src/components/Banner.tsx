"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface BannerProps {
  onBadgeClick?: () => void;
}

function Banner({ onBadgeClick }: BannerProps) {
  const { t } = useLanguage();
  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [activeVideo, setActiveVideo] = useState<1 | 2>(1);

  useEffect(() => {
    // Check if user prefers reduced motion (accessibility)
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    // Lazy load video only when component is in viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (video1Ref.current) video1Ref.current.load();
            if (video2Ref.current) video2Ref.current.load();
          }
        });
      },
      { threshold: 0.1 }
    );

    if (video1Ref.current) {
      observer.observe(video1Ref.current);
    }

    return () => {
      if (video1Ref.current) {
        observer.unobserve(video1Ref.current);
      }
    };
  }, []);

  const handleVideoLoad = () => {
    setIsVideoLoaded(true);
  };

  useEffect(() => {
    // Dual video seamless looping - crossfade between two videos
    const video1 = video1Ref.current;
    const video2 = video2Ref.current;
    if (!video1 || !video2) return;

    // Set playback speed to 0.3x (extremely slow, elegant)
    video1.playbackRate = 0.3;
    video2.playbackRate = 0.3;

    let animationFrameId: number;

    const checkLoop = () => {
      const currentVideo = activeVideo === 1 ? video1 : video2;
      const nextVideo = activeVideo === 1 ? video2 : video1;

      // Start next video 200ms before current video ends
      if (currentVideo.duration && currentVideo.currentTime >= currentVideo.duration - 0.2) {
        // Reset and start next video
        nextVideo.currentTime = 0;
        nextVideo.play().catch(err => console.log('Play error:', err));

        // Switch active video
        setActiveVideo(prev => prev === 1 ? 2 : 1);

        // Pause current video after a brief moment
        setTimeout(() => {
          currentVideo.pause();
          currentVideo.currentTime = 0;
        }, 200);
      }

      animationFrameId = requestAnimationFrame(checkLoop);
    };

    // Start the loop checker
    animationFrameId = requestAnimationFrame(checkLoop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [activeVideo]);

  // If user prefers reduced motion, show static image
  if (prefersReducedMotion) {
    return (
      <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] xl:h-[600px] 2xl:h-[700px]">
        <div suppressHydrationWarning>
          <Image
            src="/banner.png"
            alt="banner"
            width={1920}
            height={700}
            className="object-cover w-full h-full"
            priority={true}
          />
        </div>
        <div className="absolute top-1/2 w-full text-center transform -translate-y-1/2" suppressHydrationWarning>
          <div className="max-w-4xl mx-auto px-4" suppressHydrationWarning>
            <div className="flex justify-center">
              <Link href="/search">
                <button
                  className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-8 py-4 shadow-2xl rounded-full font-bold text-lg hover:shadow-3xl hover:shadow-teal-500/30 active:scale-95 transition-all duration-300 border-2 border-teal-500/50 hover:border-teal-400"
                  suppressHydrationWarning
                >
                  {t('banner.findTrustedChildcare')}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[300px] sm:h-[400px] lg:h-[500px] xl:h-[600px] 2xl:h-[700px] overflow-hidden bg-gradient-to-br from-teal-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Smooth loading state - no old banner flash */}
      {!isVideoLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-pulse text-teal-600 dark:text-teal-400">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-medium">Loading...</p>
            </div>
          </div>
        </div>
      )}

      {/* First video element */}
      <video
        ref={video1Ref}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          isVideoLoaded ? (activeVideo === 1 ? 'opacity-100' : 'opacity-0') : 'opacity-0'
        }`}
        autoPlay
        muted
        playsInline
        preload="auto"
        onLoadedData={handleVideoLoad}
        style={{
          willChange: 'opacity',
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        <source src="/banner-animation.webm?v=2" type="video/webm" />
        <source src="/banner-animation.mp4?v=2" type="video/mp4" />
      </video>

      {/* Second video element for seamless crossfade */}
      <video
        ref={video2Ref}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
          isVideoLoaded ? (activeVideo === 2 ? 'opacity-100' : 'opacity-0') : 'opacity-0'
        }`}
        muted
        playsInline
        preload="auto"
        style={{
          willChange: 'opacity',
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
        }}
      >
        <source src="/banner-animation.webm?v=2" type="video/webm" />
        <source src="/banner-animation.mp4?v=2" type="video/mp4" />
      </video>

      {/* Overlay to ensure text remains readable */}
      <div className="absolute inset-0 bg-black/10 z-20"></div>

      {/* Content overlay */}
      <div className="absolute top-1/2 w-full text-center transform -translate-y-1/2 z-30" suppressHydrationWarning>
        <div className="max-w-4xl mx-auto px-4" suppressHydrationWarning>
          {/* Single action button */}
          <div className="flex justify-center">
            <Link href="/search">
              <button
                className="bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white px-8 py-4 shadow-2xl rounded-full font-bold text-lg hover:shadow-3xl hover:shadow-teal-500/30 active:scale-95 transition-all duration-300 border-2 border-teal-500/50 hover:border-teal-400"
                suppressHydrationWarning
              >
                {t('banner.findTrustedChildcare')}
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Banner;
