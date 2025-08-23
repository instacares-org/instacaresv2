"use client";

import { useState, useEffect } from "react";
import Header from "../components/Header";
import Banner from "../components/Banner";
import CaregiverCard, { Caregiver } from "../components/CaregiverCard";

export default function Home() {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number, city?: string} | null>(null);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [selectedRadius, setSelectedRadius] = useState(20); // Default 20km - temporarily increased to test Fazila's image

  // Haversine formula to calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };

  useEffect(() => {
    requestLocationAndFetchCaregivers();
  }, []);

  const requestLocationAndFetchCaregivers = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setLocationPermission('granted');
          console.log('🌍 User location detected:', location);
          
          // Fetch location-based caregivers with current selected radius
          await fetchCaregivers(location, selectedRadius);
        },
        async (error) => {
          console.log('❌ Geolocation error:', error);
          setLocationPermission('denied');
          // Fallback to general caregivers
          await fetchCaregivers();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } else {
      console.log('❌ Geolocation not supported');
      await fetchCaregivers();
    }
  };

  const fetchCaregivers = async (location?: {lat: number, lng: number}, radiusOverride?: number) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use explicit radius if provided, otherwise use state
      const radiusToUse = radiusOverride !== undefined ? radiusOverride : selectedRadius;
      
      // Build query parameters
      let queryParams = `limit=12&_cacheBust=${Date.now()}&_forceRefresh=true`;
      if (location) {
        queryParams += `&lat=${location.lat}&lng=${location.lng}&radius=${radiusToUse}`;
      }
      
      const response = await fetch(`/api/caregivers?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch caregivers');
      }
      
      const result = await response.json();
      
      console.log(`📊 API Response for ${radiusToUse}km radius:`, {
        success: result.success,
        count: result.data?.length || 0,
        caregivers: result.data?.map((c: any) => `${c.name} (${c.distance?.toFixed(1)}km)`) || []
      });
      
      if (result.success && result.data) {
        // Transform API data to match CaregiverCard interface
        const transformedCaregivers: Caregiver[] = result.data.map((caregiver: any) => {
          
          // Use API-provided distance or calculate fallback
          let distanceText = caregiver.address?.city ? `${caregiver.address.city}, ${caregiver.address.province}` : 'Location not provided';
          let numericDistance = null;
          
          if (caregiver.distance !== undefined && caregiver.distance !== null) {
            // Use API-provided distance (already calculated server-side)
            numericDistance = caregiver.distance;
            distanceText = `${caregiver.distance.toFixed(1)} km away`;
          } else if (location && caregiver.address?.latitude && caregiver.address?.longitude) {
            // Fallback calculation if API doesn't provide distance
            const distance = calculateDistance(
              location.lat, 
              location.lng, 
              caregiver.address.latitude, 
              caregiver.address.longitude
            );
            numericDistance = distance;
            distanceText = `${distance.toFixed(1)} km away`;
          }
          
          return {
            id: caregiver.id,
            caregiverId: caregiver.caregiverId, // Add caregiverId for availability lookup
            name: caregiver.name,
            email: caregiver.email, // Add email for unique identification
            phone: caregiver.phone, // Add phone for additional identification
            city: caregiver.address?.city, // Add city for location distinction
            image: caregiver.image || caregiver.profilePhoto || '',
            profilePhoto: caregiver.profilePhoto, // Preserve the profilePhoto field separately
            rating: caregiver.averageRating || 4.5,
            reviewCount: caregiver.totalBookings || 0,
            hourlyRate: caregiver.hourlyRate,
            distance: distanceText,
            numericDistance: numericDistance, // Add numeric distance for sorting
            description: caregiver.bio || 'Experienced childcare provider',
            specialties: caregiver.services?.map((service: any) => service.type) || ['General Care'],
            location: {
              lat: caregiver.address?.latitude || 0,
              lng: caregiver.address?.longitude || 0,
              address: caregiver.address?.street || '',
            },
            availability: 'Available now',
            verified: caregiver.isVerified || caregiver.backgroundCheck || false,
            experience: `${caregiver.experienceYears || 0} years`,
            stripeAccountId: caregiver.stripeAccountId,
          };
        });
        
        // Sort caregivers by distance (closest first) to ensure proper ordering
        const sortedCaregivers = transformedCaregivers.sort((a, b) => {
          // Put caregivers with distances first, then those without
          if (a.numericDistance !== null && b.numericDistance !== null) {
            return a.numericDistance - b.numericDistance;
          }
          if (a.numericDistance !== null) return -1;
          if (b.numericDistance !== null) return 1;
          // If neither has distance, sort by rating
          return (b.rating || 0) - (a.rating || 0);
        });
        
        setCaregivers(sortedCaregivers);
      } else {
        throw new Error(result.error || 'Failed to load caregivers');
      }
    } catch (error) {
      console.error('Error fetching caregivers:', error);
      setError(error instanceof Error ? error.message : 'Failed to load caregivers');
    } finally {
      setLoading(false);
    }
  };

  const handleRadiusChange = (newRadius: number) => {
    setSelectedRadius(newRadius);
    if (userLocation) {
      // Pass the new radius explicitly to avoid state batching issues
      fetchCaregivers(userLocation, newRadius);
    }
  };

  return (
    <div className="">
      <Header />
      <Banner />

      {/* Location Permission Banner */}
      {locationPermission === 'prompt' && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Find caregivers closest to you
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Enable location access to discover trusted providers in your area
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center space-x-3">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wide">Search within:</label>
                  <div className="relative">
                    <select 
                      value={selectedRadius} 
                      onChange={(e) => {
                        const newRadius = Number(e.target.value);
                        setSelectedRadius(newRadius);
                        // Note: No location yet, so just update the state for when location is enabled
                      }}
                      className="appearance-none bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-600 focus:border-rose-500 dark:focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 dark:focus:ring-rose-400/20 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-xl px-4 py-2.5 pr-10 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md focus:shadow-lg min-w-[100px] backdrop-blur-sm transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <option value={1} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2">📍 1 km</option>
                      <option value={5} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2">🏘️ 5 km</option>
                      <option value={10} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2">🏙️ 10 km</option>
                      <option value={20} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2">🌆 20 km</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <button
                  onClick={requestLocationAndFetchCaregivers}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Enable Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {locationPermission === 'denied' && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Location access denied
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Showing caregivers from across Canada. 
                    <button 
                      onClick={requestLocationAndFetchCaregivers}
                      className="ml-1 underline hover:no-underline font-medium"
                    >
                      Try again
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main>
        <section className="pt-6 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
            <h2 className="text-black dark:text-white text-3xl font-semibold">Trusted childcare providers near you</h2>
            {userLocation && (
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span className="inline-flex items-center gap-2">
                    <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Showing providers within {selectedRadius}km of your location
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wide">Distance:</label>
                  <div className="relative">
                    <select 
                      value={selectedRadius} 
                      onChange={(e) => handleRadiusChange(Number(e.target.value))}
                      className="appearance-none bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-600 focus:border-rose-500 dark:focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 dark:focus:ring-rose-400/20 text-sm font-medium text-gray-900 dark:text-gray-100 rounded-xl px-4 py-2.5 pr-10 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md focus:shadow-lg min-w-[100px] backdrop-blur-sm transform hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <option value={1} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2">📍 1 km</option>
                      <option value={5} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2">🏘️ 5 km</option>
                      <option value={10} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2">🏙️ 10 km</option>
                      <option value={20} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2">🌆 20 km</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" suppressHydrationWarning>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1,2,3,4,5,6,7,8].map((item) => (
                <div key={item} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
                  <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-t-xl"></div>
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                    <div className="flex justify-between">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchCaregivers}
                className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg transition"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && caregivers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">No caregivers found in your area.</p>
            </div>
          )}

          {!loading && !error && caregivers.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {caregivers.map((caregiver) => (
                <CaregiverCard
                  key={caregiver.id}
                  caregiver={caregiver}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}