"use client";

import React, { useState, useEffect } from "react";
import { Caregiver } from "./CaregiverCard";
import Image from "next/image";
import { StarIcon, MapPinIcon } from "@heroicons/react/24/solid";
import CaregiverProfileImage from "./CaregiverProfileImage";

interface FallbackMapProps {
  caregivers: Caregiver[];
  selectedCaregiver?: Caregiver | null;
  onCaregiverSelect?: (caregiver: Caregiver) => void;
  searchLocation?: {lat: number, lng: number} | null;
}

export default function FallbackMap({ caregivers, selectedCaregiver, onCaregiverSelect, searchLocation }: FallbackMapProps) {
  const [hoveredCaregiver, setHoveredCaregiver] = useState<Caregiver | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationSource, setLocationSource] = useState<'gps' | 'default'>('default');

  // Get user's current location (simplified for fallback map)
  const getUserLocation = () => {
    return new Promise<{source: 'gps' | 'default'}>((resolve) => {
      if (!navigator.geolocation) {
        resolve({ source: 'default' });
        return;
      }

      const timeoutId = setTimeout(() => {
        resolve({ source: 'default' });
      }, 3000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          console.log('User location detected for fallback map');
          resolve({ source: 'gps' });
        },
        () => {
          clearTimeout(timeoutId);
          resolve({ source: 'default' });
        },
        { timeout: 2000 }
      );
    });
  };

  // Initialize location detection (only if no search location provided)
  useEffect(() => {
    // If we have a search location, don't initialize with GPS - prioritize search location
    if (searchLocation) {
      setIsLoadingLocation(false);
      setLocationSource('default');
      return;
    }

    const initializeLocation = async () => {
      setIsLoadingLocation(true);
      try {
        const location = await getUserLocation();
        setLocationSource(location.source);
      } catch (error) {
        setLocationSource('default');
      } finally {
        setIsLoadingLocation(false);
      }
    };

    initializeLocation();
  }, [searchLocation]);

  return (
    <div className="h-full w-full relative bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
      {/* Map Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="grid grid-cols-12 h-full">
          {Array.from({ length: 144 }).map((_, i) => (
            <div key={i} className="border border-gray-300"></div>
          ))}
        </div>
      </div>

      {/* Caregiver Markers */}
      <div className="relative w-full h-full max-w-4xl max-h-4xl mx-auto">
        {caregivers.map((caregiver, index) => {
          // Position markers in a scattered layout
          const positions = [
            { top: '20%', left: '25%' },
            { top: '35%', left: '60%' },
            { top: '15%', left: '75%' },
            { top: '65%', left: '20%' },
            { top: '45%', left: '85%' },
            { top: '80%', left: '45%' },
            { top: '25%', left: '40%' },
            { top: '55%', left: '70%' },
            { top: '10%', left: '50%' },
            { top: '75%', left: '25%' },
            { top: '40%', left: '15%' },
            { top: '85%', left: '65%' },
          ];
          
          const position = positions[index % positions.length];
          const isSelected = selectedCaregiver?.id === caregiver.id;
          const isHovered = hoveredCaregiver?.id === caregiver.id;

          return (
            <div
              key={caregiver.id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 hover:z-10"
              style={{ top: position.top, left: position.left }}
              onClick={() => onCaregiverSelect?.(caregiver)}
              onMouseEnter={() => setHoveredCaregiver(caregiver)}
              onMouseLeave={() => setHoveredCaregiver(null)}
            >
              {/* Marker */}
              <div className={`relative transition-all duration-200 ${
                isSelected || isHovered ? 'scale-125' : 'hover:scale-110'
              }`}>
                <div className={`w-12 h-12 rounded-full border-3 overflow-hidden shadow-lg ${
                  isSelected ? 'border-rose-500 shadow-rose-200' : 'border-white shadow-md'
                }`}>
                  <CaregiverProfileImage
                    name={caregiver.name}
                    id={caregiver.id}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                </div>
                
                {/* Price Tag */}
                <div className="absolute -bottom-2 -right-1 bg-white rounded-full px-2 py-1 text-xs font-bold shadow-sm border">
                  ${caregiver.hourlyRate}
                </div>
              </div>

              {/* Popup on Hover */}
              {isHovered && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-white rounded-lg shadow-lg border p-3 w-64 z-20">
                  <div className="flex items-start space-x-3">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                      <CaregiverProfileImage
                        name={caregiver.name}
                        id={caregiver.id}
                        fill={true}
                        className="rounded-full"
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {caregiver.name}
                      </h3>
                      
                      <div className="flex items-center mt-1">
                        <StarIcon className="h-3 w-3 text-yellow-400" />
                        <span className="ml-1 text-xs text-gray-600">
                          {caregiver.rating} ({caregiver.reviewCount})
                        </span>
                      </div>
                      
                      <div className="flex items-center mt-1">
                        <MapPinIcon className="h-3 w-3 text-gray-400" />
                        <span className="ml-1 text-xs text-gray-600">
                          {caregiver.distance}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold text-gray-900">
                          ${caregiver.hourlyRate}/hr
                        </span>
                        <span className="text-xs text-green-600">
                          {caregiver.availability}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCaregiverSelect?.(caregiver);
                    }}
                    className="w-full mt-3 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium py-1.5 px-3 rounded transition"
                  >
                    View Details
                  </button>
                  
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="w-2 h-2 bg-white border-b border-r border-gray-200 rotate-45"></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Map Info */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-md p-3">
        <div className="text-sm font-medium text-gray-900 mb-1">
          {searchLocation ? 'Search Results' : 'Canada Wide'}
        </div>
        <div className="text-xs text-gray-600 mb-2">
          {caregivers.length} caregivers found
        </div>
        <div className="text-xs text-gray-500">
          {searchLocation ? (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Showing search area</span>
            </div>
          ) : isLoadingLocation ? (
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Finding your location...</span>
            </div>
          ) : locationSource === 'gps' ? (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Demo map - your area detected</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span>📍</span>
              <button 
                onClick={() => window.location.reload()}
                className="text-blue-600 hover:underline text-xs"
              >
                Enable Location
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Development Notice */}
      <div className="absolute bottom-4 right-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3 max-w-sm shadow-lg">
        <div className="text-xs text-green-700 dark:text-green-300">
          <div className="font-semibold mb-1 flex items-center">
            <span className="text-green-500 mr-1">✓</span>
            Development Mode - OpenStreetMap Fallback
          </div>
          <p className="text-green-600 dark:text-green-400 mb-2">
            Using fallback map to avoid Mapbox conflicts with production (instacares.net)
          </p>
          <details className="cursor-pointer">
            <summary className="text-green-500 hover:underline">
              Want full Mapbox maps?
            </summary>
            <div className="mt-2 space-y-1 text-[10px] text-gray-600 dark:text-gray-400">
              <p>1. Create development token at <a href="https://mapbox.com" target="_blank" className="text-blue-500 underline">mapbox.com</a></p>
              <p>2. Add to .env.local:</p>
              <code className="block bg-gray-100 dark:bg-gray-700 p-1 rounded text-[9px]">
                NEXT_PUBLIC_MAPBOX_TOKEN="your_dev_token"
              </code>
              <p>3. Restart dev server</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}