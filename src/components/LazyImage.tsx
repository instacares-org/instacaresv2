"use client";

import { useState, useRef, useCallback } from 'react';
import OptimizedImage from './OptimizedImage';

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fallbackSrc?: string;
  priority?: boolean;
  sizes?: string;
  placeholder?: React.ReactNode;
}

export default function LazyImage({
  src,
  alt,
  width,
  height,
  className = "",
  fallbackSrc,
  priority = false,
  sizes,
  placeholder,
}: LazyImageProps) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer to detect when image enters viewport
  const observerRef = useCallback((node: HTMLDivElement) => {
    if (node) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1, rootMargin: '50px' }
      );
      observer.observe(node);
    }
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const defaultPlaceholder = (
    <div className={`bg-gray-200 animate-pulse flex items-center justify-center ${className}`}>
      <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
      </svg>
    </div>
  );

  return (
    <div 
      ref={observerRef}
      className={`relative ${className}`}
      style={{ width, height }}
    >
      {(!isInView || !isLoaded) && (placeholder || defaultPlaceholder)}
      
      {isInView && (
        <OptimizedImage
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          fallbackSrc={fallbackSrc}
          priority={priority}
          sizes={sizes}
          onLoad={handleLoad}
        />
      )}
    </div>
  );
}