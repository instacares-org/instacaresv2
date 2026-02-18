"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Caregiver } from "./CaregiverCard";
import FallbackMap from "./FallbackMap";
import { useTheme } from "../contexts/ThemeContext";

// Dynamically import Map components to avoid SSR issues
const Map = dynamic(() => import("react-map-gl").then(mod => mod.default), { ssr: false });
const Marker = dynamic(() => import("react-map-gl").then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import("react-map-gl").then(mod => mod.Popup), { ssr: false });

// Import mapbox CSS
import 'mapbox-gl/dist/mapbox-gl.css';
import Image from "next/image";
import { StarIcon } from "@heroicons/react/24/solid";

// You'll need to get a Mapbox access token from https://www.mapbox.com/
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Interface for map viewport state
export interface MapViewport {
  latitude: number;
  longitude: number;
  zoom: number;
}

// Calculate radius in km based on zoom level
export function getRadiusFromZoom(zoom: number): number {
  // More generous radius calculation that matches visible map area
  // At each zoom level, the visible area roughly halves
  // Using a lookup table for better control
  const zoomRadiusMap: Record<number, number> = {
    5: 500,   // Country level
    6: 300,
    7: 150,
    8: 80,
    9: 40,
    10: 25,   // City level
    11: 15,   // District level - initial default
    12: 10,
    13: 7,
    14: 5,    // Neighborhood level
    15: 3,
    16: 2,
    17: 1.5,
    18: 1,
  };

  // Get the radius for the zoom level, interpolating for in-between values
  const floorZoom = Math.floor(zoom);
  const ceilZoom = Math.ceil(zoom);

  const floorRadius = zoomRadiusMap[floorZoom] || (floorZoom < 5 ? 500 : 1);
  const ceilRadius = zoomRadiusMap[ceilZoom] || (ceilZoom < 5 ? 500 : 1);

  // Linear interpolation
  const fraction = zoom - floorZoom;
  const radius = floorRadius + (ceilRadius - floorRadius) * fraction;

  return Math.round(radius * 10) / 10; // Round to 1 decimal place
}

interface CaregiverMapProps {
  caregivers: Caregiver[];
  selectedCaregiver?: Caregiver | null;
  onCaregiverSelect?: (caregiver: Caregiver) => void;
  searchLocation?: {lat: number, lng: number} | null;
  onViewportChange?: (viewport: MapViewport) => void;
  searchAsIMove?: boolean;
}

export default function CaregiverMap({ caregivers, selectedCaregiver, onCaregiverSelect, searchLocation, onViewportChange, searchAsIMove = true }: CaregiverMapProps) {
  // Hooks must be called before any conditional returns
  const { theme } = useTheme();
  const [viewState, setViewState] = useState({
    longitude: -79.3832,
    latitude: 43.6532, // Default to Toronto coordinates
    zoom: 12
  });
  
  const [popupInfo, setPopupInfo] = useState<Caregiver | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationSource, setLocationSource] = useState<'gps' | 'default'>('default');
  const mapRef = useRef<any>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced viewport change handler (400ms as per spec)
  const handleViewportChange = (newViewState: { latitude: number; longitude: number; zoom: number }) => {
    if (!onViewportChange || !searchAsIMove) return;

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new debounced timeout
    debounceTimeoutRef.current = setTimeout(() => {
      console.log('🗺️ Map viewport changed (debounced):', newViewState);
      onViewportChange({
        latitude: newViewState.latitude,
        longitude: newViewState.longitude,
        zoom: newViewState.zoom
      });
    }, 400); // 400ms debounce as per spec
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Get user's current location
  const getUserLocation = () => {
    return new Promise<{lat: number, lng: number, source: 'gps' | 'default'}>((resolve) => {
      console.log('🎯 Starting GPS location request...');
      
      // Detect Brave browser first
      const isBrave = typeof navigator !== 'undefined' && (navigator as any).brave !== undefined;
      if (isBrave) {
        console.log('🦁 Brave browser detected - attempting workaround...');
      }
      
      if (!navigator.geolocation) {
        console.log('❌ Geolocation not supported, using default location');
        resolve({ lat: 43.6532, lng: -79.3832, source: 'default' });
        return;
      }

      const timeoutId = setTimeout(() => {
        console.log('⏰ Geolocation timeout after 5 seconds, using default location');
        if (isBrave) {
          console.log('🦁 Brave Shield is likely blocking geolocation');
          console.log('🛡️ SOLUTION: Click Brave icon → Set Shields DOWN for this site');
        }
        resolve({ lat: 43.6532, lng: -79.3832, source: 'default' });
      }, 5000); // 5 second timeout

      // Try with less strict options for Brave
      const geoOptions = isBrave ? {
        enableHighAccuracy: false,  // Less strict for Brave
        timeout: 10000,             // Longer timeout for Brave
        maximumAge: 0               // Force fresh request
      } : {
        enableHighAccuracy: true,
        timeout: 4000,
        maximumAge: 60000
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          console.log('✅ GPS location obtained:', position.coords);
          resolve({ 
            lat: position.coords.latitude, 
            lng: position.coords.longitude, 
            source: 'gps' 
          });
        },
        (error) => {
          clearTimeout(timeoutId);
          console.log('❌ GPS error:', error);
          if (isBrave) {
            console.log('🦁 Brave Shield likely blocked geolocation request');
            console.log('🛡️ SOLUTION: Click Brave icon → Set Shields DOWN for this site');
          }
          resolve({ lat: 43.6532, lng: -79.3832, source: 'default' });
        },
        geoOptions
      );
    });
  };

  // Initialize map with user's location (only if no search location provided)
  useEffect(() => {
    console.log('🗺️ Map initialization effect running...');
    console.log('🔍 Search location:', searchLocation);
    
    // If we have a search location, don't initialize with GPS - prioritize search location
    if (searchLocation) {
      console.log('⭐ Search location provided, skipping GPS initialization');
      setIsLoadingLocation(false);
      setLocationSource('default');
      return;
    }

    const initializeLocation = async () => {
      console.log('🚀 Starting location initialization...');
      setIsLoadingLocation(true);
      try {
        const location = await getUserLocation();
        console.log('📍 Location received:', location);
        
        setLocationSource(location.source);
        
        const newViewState = {
          ...viewState,
          latitude: location.lat,
          longitude: location.lng,
          zoom: location.source === 'gps' ? 14 : 11 // Closer zoom for GPS location
        };
        
        console.log('🎯 Setting new view state:', newViewState);
        setViewState(newViewState);
        
        // Force map to center on location
        if (mapRef.current && location.source === 'gps') {
          console.log('🗺️ Flying map to GPS location');
          setTimeout(() => {
            mapRef.current?.flyTo({
              center: [location.lng, location.lat],
              zoom: 14,
              duration: 2000
            });
          }, 100);
        }
        
      } catch (error) {
        console.error('❌ Error getting user location:', error);
        setLocationSource('default');
      } finally {
        setIsLoadingLocation(false);
      }
    };

    initializeLocation();
  }, []); // Empty dependency array - runs once on mount

  // Update view when search location changes
  useEffect(() => {
    if (searchLocation) {
      console.log('🎯 Updating view to search location:', searchLocation);
      const newViewState = {
        latitude: searchLocation.lat,
        longitude: searchLocation.lng,
        zoom: 11 // Good zoom level for search results
      };
      setViewState(newViewState);
      setLocationSource('default');
      
      // Animate map to search location
      if (mapRef.current) {
        setTimeout(() => {
          mapRef.current?.flyTo({
            center: [searchLocation.lng, searchLocation.lat],
            zoom: 11,
            duration: 1500
          });
        }, 100);
      }
    }
  }, [searchLocation]);

  // Log caregivers for debugging, but don't auto-zoom to fit them
  useEffect(() => {
    console.log('📍 Caregivers updated, count:', caregivers.length);
    const validCaregivers = caregivers.filter(c => c.location.lat && c.location.lng && c.location.lat !== 0 && c.location.lng !== 0);
    console.log('📍 Valid caregivers with coordinates:', validCaregivers.length);
    // Note: We keep the map centered on user location, not auto-fitting to caregiver bounds
  }, [caregivers]);

  // Emit initial viewport when map is ready and searchAsIMove is enabled
  // This ensures the caregiver list is filtered on initial load
  const hasEmittedInitialViewport = useRef(false);
  useEffect(() => {
    if (onViewportChange && searchAsIMove && !isLoadingLocation && !hasEmittedInitialViewport.current) {
      // Small delay to ensure map has rendered
      const timer = setTimeout(() => {
        console.log('🗺️ Emitting initial viewport:', viewState);
        onViewportChange({
          latitude: viewState.latitude,
          longitude: viewState.longitude,
          zoom: viewState.zoom
        });
        hasEmittedInitialViewport.current = true;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [onViewportChange, searchAsIMove, isLoadingLocation, viewState]);

  // If no valid Mapbox token, show fallback map
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('example')) {
    return (
      <FallbackMap
        caregivers={caregivers}
        selectedCaregiver={selectedCaregiver}
        onCaregiverSelect={onCaregiverSelect}
        searchLocation={searchLocation}
      />
    );
  }

  // Choose map style based on theme
  const getMapStyle = () => {
    switch (theme) {
      case 'light':
        return 'mapbox://styles/mapbox/streets-v12';
      case 'dark':
      default:
        // Premium dark styles for better visual appeal
        return 'mapbox://styles/mapbox/dark-v11'; // Classic dark style - more reliable
        // Alternative options:
        // return 'mapbox://styles/mapbox/navigation-night-v1'; // Navigation focused
        // return 'mapbox://styles/mapbox/satellite-streets-v12'; // Satellite with dark overlay
    }
  };


  const pins = caregivers
    .filter(caregiver => caregiver.location.lat && caregiver.location.lng && caregiver.location.lat !== 0 && caregiver.location.lng !== 0)
    .map((caregiver) => (
      <Marker
        key={caregiver.id}
        longitude={caregiver.location.lng}
        latitude={caregiver.location.lat}
        onClick={(e) => {
          e.originalEvent.stopPropagation();
          setPopupInfo(caregiver);
          onCaregiverSelect?.(caregiver);
        }}
      >
        <div 
          className={`w-12 h-12 rounded-full border-3 cursor-pointer transition-all hover:scale-110 hover:shadow-xl ${
            selectedCaregiver?.id === caregiver.id 
              ? 'border-rose-400 shadow-xl scale-110 ring-2 ring-rose-300' 
              : 'border-white dark:border-gray-800 shadow-lg hover:border-rose-200'
          }`}
          style={{ 
            backgroundImage: `url(${caregiver.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-full px-1.5 py-0.5 text-xs font-bold shadow-lg">
            ${caregiver.hourlyRate}
          </div>
        </div>
      </Marker>
    ));

  return (
    <div className="h-full w-full relative">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => setViewState(evt.viewState)}
        onMoveEnd={(evt) => handleViewportChange(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: "100%", height: "100%" }}
        mapStyle={getMapStyle()}
        attributionControl={false}
      >
        {pins}

        {popupInfo && (
          <Popup
            anchor="top"
            longitude={popupInfo.location.lng}
            latitude={popupInfo.location.lat}
            onClose={() => setPopupInfo(null)}
            closeButton={true}
            closeOnClick={false}
            className="caregiver-popup"
          >
            <div className="p-2 max-w-xs">
              <div className="flex items-start space-x-3">
                <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                  <Image
                    src={popupInfo.image}
                    alt={popupInfo.name}
                    fill
                    className="object-cover"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {popupInfo.name}
                  </h3>
                  
                  <div className="flex items-center mt-1">
                    <StarIcon className="h-3 w-3 text-yellow-400" />
                    <span className="ml-1 text-xs text-gray-600">
                      {popupInfo.rating} ({popupInfo.reviewCount})
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-semibold text-gray-900">
                      ${popupInfo.hourlyRate}/hr
                    </span>
                    <span className="text-xs text-gray-500">
                      {popupInfo.distance}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onCaregiverSelect?.(popupInfo)}
                className="w-full mt-3 bg-rose-500 hover:bg-rose-600 text-white text-xs font-medium py-1.5 px-3 rounded transition"
              >
                View Details
              </button>
            </div>
          </Popup>
        )}
      </Map>

      {/* Map Controls */}
      <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3">
        <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
          {caregivers.length} caregivers found
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400">
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
              <span>Showing your area</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span>📍</span>
              <button 
                onClick={async () => {
                  console.log('🔄 Manual location request triggered');
                  setIsLoadingLocation(true);
                  try {
                    const location = await getUserLocation();
                    console.log('📍 Manual location received:', location);
                    
                    setLocationSource(location.source);
                    
                    const newViewState = {
                      latitude: location.lat,
                      longitude: location.lng,
                      zoom: location.source === 'gps' ? 14 : 11
                    };
                    
                    setViewState(prev => ({ ...prev, ...newViewState }));
                    
                    if (mapRef.current && location.source === 'gps') {
                      mapRef.current.flyTo({
                        center: [location.lng, location.lat],
                        zoom: 14,
                        duration: 2000
                      });
                    }
                  } catch (error) {
                    console.error('❌ Manual location request failed:', error);
                  } finally {
                    setIsLoadingLocation(false);
                  }
                }}
                className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
              >
                Enable Location
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Location Permission Notice */}
      {(isLoadingLocation || locationSource === 'default') && !searchLocation && (
        <div className="absolute top-20 right-4 bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 rounded-lg p-3 max-w-xs">
          <div className="text-xs text-blue-600 dark:text-blue-300">
            <strong>📍 Enable location access</strong> to see Toronto caregivers near you
            <div className="mt-2 text-[10px] text-blue-500 dark:text-blue-400">
              {typeof navigator !== 'undefined' && (navigator as any).brave ? (
                <>
                  <div className="font-bold text-orange-600 dark:text-orange-400 mb-1">
                    🦁 Brave Shields Blocking Location!
                  </div>
                  <div className="font-semibold">Quick Fix:</div>
                  <div>1. Click Brave icon (🦁) in address bar</div>
                  <div className="text-red-600 dark:text-red-400 font-bold">
                    2. Toggle "Shields DOWN for this site"
                  </div>
                  <div>3. Refresh the page (F5)</div>
                  <div className="mt-1 text-[9px] text-gray-500">
                    ⚠️ Just allowing location is NOT enough - shields must be DOWN
                  </div>
                </>
              ) : (
                <>Click the 🔒 icon in your address bar → Location → Allow</>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}