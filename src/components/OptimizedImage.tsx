"use client";

import Image from "next/image";
import { useState } from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  priority?: boolean;
  placeholder?: "blur" | "empty";
  blurDataURL?: string;
  fallbackSrc?: string;
  sizes?: string;
  onError?: () => void;
  onLoad?: () => void;
  style?: React.CSSProperties;
}

// Generate a simple blur placeholder
const generateBlurDataURL = (width: number = 100, height: number = 100): string => {
  const canvas = typeof window !== 'undefined' ? document.createElement('canvas') : null;
  if (!canvas) return '';
  
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // Create a simple gradient blur placeholder
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#f3f4f6');
  gradient.addColorStop(1, '#e5e7eb');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  return canvas.toDataURL('image/jpeg', 0.1);
};

export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  fill = false,
  className = "",
  priority = false,
  placeholder = "blur",
  blurDataURL,
  fallbackSrc,
  sizes,
  onError,
  onLoad,
  style,
}: OptimizedImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Generate responsive sizes for better performance
  const responsiveSizes = sizes || (
    fill ? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw" : 
    width && width <= 96 ? "(max-width: 768px) 100vw, 96px" :
    width && width <= 256 ? "(max-width: 768px) 100vw, 256px" :
    width && width <= 384 ? "(max-width: 768px) 100vw, 384px" :
    "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  );

  // Use fallback image if primary image fails
  const imageSrc = imageError && fallbackSrc ? fallbackSrc : src;

  // Generate blur placeholder if not provided
  const defaultBlurDataURL = blurDataURL || (
    typeof window !== 'undefined' && width && height ? 
    generateBlurDataURL(Math.min(width, 40), Math.min(height, 40)) : 
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R+Rq3JDoxwyC4Q4cj7tON2cBHTBOI29PHvT2nN1Mg8pSZCzw1Bg9Gn0XBUrxpF/Qdt6f7h3yq7yx1v/2Q=='
  );

  const handleImageError = () => {
    setImageError(true);
    setIsLoading(false);
    onError?.();
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  return (
    <div className={`relative ${className}`} style={style}>
      {/* Loading placeholder */}
      {isLoading && placeholder === "blur" && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded" />
      )}
      
      <Image
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        fill={fill}
        className={`object-cover transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        priority={priority}
        placeholder={placeholder}
        blurDataURL={defaultBlurDataURL}
        sizes={responsiveSizes}
        onError={handleImageError}
        onLoad={handleImageLoad}
        // Enable optimizations
        quality={85} // Good balance between quality and file size
        loading={priority ? "eager" : "lazy"}
      />
    </div>
  );
}