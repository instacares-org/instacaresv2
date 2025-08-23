"use client";

import { useEffect, useState } from 'react';
import Image, { ImageProps } from 'next/image';

interface HydrationSafeImageProps extends Omit<ImageProps, 'src'> {
  src: string;
  fallbackSrc?: string;
}

/**
 * HydrationSafeImage component prevents hydration mismatches
 * by ensuring consistent rendering between server and client
 */
export default function HydrationSafeImage({ 
  src, 
  fallbackSrc,
  alt,
  className = '',
  ...props 
}: HydrationSafeImageProps) {
  const [mounted, setMounted] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleError = () => {
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    }
  };

  // During SSR, show a simple div to prevent hydration mismatch
  if (!mounted) {
    return (
      <div 
        className={`bg-gray-200 animate-pulse ${className}`}
        {...(props.width && typeof props.width === 'number' ? { style: { width: props.width } } : {})}
        {...(props.height && typeof props.height === 'number' ? { style: { height: props.height } } : {})}
      />
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      className={className}
      onError={handleError}
      {...props}
      // Prevent layout shift
      style={{
        ...props.style,
        objectFit: props.style?.objectFit || 'cover',
      }}
    />
  );
}