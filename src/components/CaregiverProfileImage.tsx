"use client";

import { useState } from "react";
import OptimizedImage from "./OptimizedImage";

interface CaregiverProfileImageProps {
  name: string;
  id: string;
  imageUrl?: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}

// Generate a consistent avatar based on name and id
const generateAvatar = (name: string, id: string) => {
  const colors = [
    'bg-gradient-to-br from-pink-400 to-red-400',
    'bg-gradient-to-br from-blue-400 to-indigo-400',
    'bg-gradient-to-br from-green-400 to-emerald-400',
    'bg-gradient-to-br from-purple-400 to-violet-400',
    'bg-gradient-to-br from-orange-400 to-amber-400',
    'bg-gradient-to-br from-teal-400 to-cyan-400',
    'bg-gradient-to-br from-rose-400 to-pink-400',
    'bg-gradient-to-br from-indigo-400 to-blue-400',
    'bg-gradient-to-br from-emerald-400 to-green-400',
    'bg-gradient-to-br from-violet-400 to-purple-400',
    'bg-gradient-to-br from-amber-400 to-orange-400',
    'bg-gradient-to-br from-cyan-400 to-teal-400',
  ];
  
  // Use the string hash for consistent color selection
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % colors.length;
  
  // Get initials from name
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  const initials = nameParts.length >= 2 
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : nameParts[0] ? nameParts[0].substring(0, 2).toUpperCase() : '??';
  
  return {
    color: colors[colorIndex],
    initials: initials
  };
};

export default function CaregiverProfileImage({ 
  name, 
  id,
  imageUrl: providedImageUrl,
  className = "", 
  width,
  height,
  fill = false 
}: CaregiverProfileImageProps) {
  const [imageError, setImageError] = useState(false);
  const avatar = generateAvatar(name, id);
  
  // Use provided image URL or fallback to default image
  const imageUrl = providedImageUrl || `/caregivers/default.svg`;
  
  // Show avatar if image loading failed, no id, or no image URL available
  const shouldShowAvatar = imageError || !id;
  
  if (shouldShowAvatar) {
    // For fill mode, use absolute positioning
    if (fill) {
      return (
        <div className={`absolute inset-0 ${avatar.color} flex items-center justify-center text-white font-bold ${className}`}>
          <span className="text-2xl">
            {avatar.initials}
          </span>
        </div>
      );
    }
    
    // For fixed dimensions
    return (
      <div 
        className={`${avatar.color} flex items-center justify-center text-white font-bold ${className}`}
        style={{ width: width || '100%', height: height || '100%' }}
      >
        <span className="text-2xl">
          {avatar.initials}
        </span>
      </div>
    );
  }

  // Remove cache busting for better optimization
  const imageSrc = imageUrl;
  
  return (
    <OptimizedImage
      src={imageSrc}
      alt={name}
      width={width}
      height={height}
      fill={fill}
      className={className}
      onError={() => setImageError(true)}
      onLoad={() => setImageError(false)}
      priority={false} // Only prioritize above-the-fold images
      placeholder="blur"
      sizes={fill ? "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw" : width ? `${width}px` : "(max-width: 768px) 100vw, 200px"}
    />
  );
}