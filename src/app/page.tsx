"use client";

import { useState, useEffect } from "react";
import Header, { FilterState } from "../components/Header";
import Banner from "../components/Banner";
import CaregiverCard, { Caregiver } from "../components/CaregiverCard";
import Footer from "../components/Footer";

export default function Home() {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [allCaregivers, setAllCaregivers] = useState<Caregiver[]>([]); // Store all caregivers for filtering
  const [loading, setLoading] = useState(true);
  const [showSafetySection, setShowSafetySection] = useState(false);
  
  // Smart filter state
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    priceRange: 'any',
    ageGroups: [],
    specialServices: [],
    experience: 'any',
    availability: [],
    highlyRated: false,
    sortBy: 'recommended'
  });

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

  // Sorting logic (copied from search page)
  const sortCaregivers = (caregivers: Caregiver[], sortBy: string): Caregiver[] => {
    const sorted = [...caregivers];
    
    switch (sortBy) {
      case 'price-low':
        return sorted.sort((a, b) => a.hourlyRate - b.hourlyRate);
      
      case 'price-high':
        return sorted.sort((a, b) => b.hourlyRate - a.hourlyRate);
      
      case 'rating-high':
        return sorted.sort((a, b) => {
          const ratingDiff = b.rating - a.rating;
          if (ratingDiff !== 0) return ratingDiff;
          return b.reviewCount - a.reviewCount;
        });
      
      case 'reviews-most':
        return sorted.sort((a, b) => b.reviewCount - a.reviewCount);
      
      case 'newest':
        return sorted.reverse();
      
      case 'recommended':
      default:
        // Recommended sorting: blend of rating, reviews, distance, and availability
        return sorted.sort((a, b) => {
          // First prioritize by distance (closer is better)
          if (a.numericDistance !== null && b.numericDistance !== null) {
            const distanceWeight = (5 - Math.min(a.numericDistance, 5)) * 0.3; // Distance bonus
            const distanceWeightB = (5 - Math.min(b.numericDistance, 5)) * 0.3;
            
            const scoreA = (a.rating * 0.4) + (Math.min(a.reviewCount / 10, 5) * 0.2) + 
                          (a.verified ? 1.5 : 0) + (a.availability?.includes('Available') ? 1 : 0) + distanceWeight;
            const scoreB = (b.rating * 0.4) + (Math.min(b.reviewCount / 10, 5) * 0.2) + 
                          (b.verified ? 1.5 : 0) + (b.availability?.includes('Available') ? 1 : 0) + distanceWeightB;
            return scoreB - scoreA;
          }
          
          // If one has distance and other doesn't, prioritize the one with distance
          if (a.numericDistance !== null) return -1;
          if (b.numericDistance !== null) return 1;
          
          // Neither has distance, use standard scoring
          const scoreA = (a.rating * 0.4) + (Math.min(a.reviewCount / 10, 5) * 0.3) + (a.verified ? 2 : 0) + (a.availability?.includes('Available') ? 1 : 0);
          const scoreB = (b.rating * 0.4) + (Math.min(b.reviewCount / 10, 5) * 0.3) + (b.verified ? 2 : 0) + (b.availability?.includes('Available') ? 1 : 0);
          return scoreB - scoreA;
        });
    }
  };

  // Filtering and sorting logic (simplified from search page for main page)
  const filterAndSortCaregivers = (caregivers: Caregiver[], filters: FilterState): Caregiver[] => {
    let filtered = [...caregivers];

    // 1. PRICE RANGE FILTERING
    if (filters.priceRange !== 'any') {
      filtered = filtered.filter(caregiver => {
        const rate = caregiver.hourlyRate;
        switch (filters.priceRange) {
          case '15-25': return rate >= 15 && rate <= 25;
          case '25-35': return rate >= 25 && rate <= 35;
          case '35-45': return rate >= 35 && rate <= 45;
          case '45+': return rate >= 45;
          default: return true;
        }
      });
    }

    // 2. AGE GROUP FILTERING
    if (filters.ageGroups.length > 0) {
      filtered = filtered.filter(caregiver => {
        const specialties = caregiver.specialties.map(s => s.toLowerCase());
        const description = (caregiver.bio || caregiver.description || '').toLowerCase();
        
        return filters.ageGroups.some(ageGroup => {
          switch (ageGroup) {
            case 'infants':
              return specialties.some(s => s.includes('infant') || s.includes('baby')) ||
                     description.includes('infant') || description.includes('baby');
            case 'toddlers':
              return specialties.some(s => s.includes('toddler')) ||
                     description.includes('toddler');
            case 'schoolage':
              return specialties.some(s => s.includes('school') || s.includes('child')) ||
                     description.includes('school') || description.includes('child');
            case 'teens':
              return specialties.some(s => s.includes('teen') || s.includes('adolescent')) ||
                     description.includes('teen') || description.includes('adolescent');
            default:
              return false;
          }
        });
      });
    }

    // 3. SPECIAL SERVICES FILTERING
    if (filters.specialServices.length > 0) {
      filtered = filtered.filter(caregiver => {
        const specialties = caregiver.specialties.map(s => s.toLowerCase());
        const description = (caregiver.bio || caregiver.description || '').toLowerCase();
        
        return filters.specialServices.some(service => {
          switch (service) {
            case 'overnight':
              return specialties.some(s => s.includes('overnight')) ||
                     description.includes('overnight');
            case 'tutoring':
              return specialties.some(s => s.includes('tutor') || s.includes('homework')) ||
                     description.includes('tutor') || description.includes('homework');
            case 'cooking':
              return specialties.some(s => s.includes('cook') || s.includes('meal')) ||
                     description.includes('cook') || description.includes('meal');
            case 'housekeeping':
              return specialties.some(s => s.includes('clean') || s.includes('housekeep')) ||
                     description.includes('clean') || description.includes('housekeep');
            case 'pets':
              return specialties.some(s => s.includes('pet')) ||
                     description.includes('pet');
            default:
              return false;
          }
        });
      });
    }

    // 4. EXPERIENCE FILTERING
    if (filters.experience !== 'any') {
      filtered = filtered.filter(caregiver => {
        const years = caregiver.experienceYears || 0;
        switch (filters.experience) {
          case '1-2': return years >= 1 && years <= 2;
          case '3-5': return years >= 3 && years <= 5;
          case '5+': return years >= 5;
          default: return true;
        }
      });
    }

    // 5. HIGHLY RATED FILTERING
    if (filters.highlyRated) {
      filtered = filtered.filter(caregiver => caregiver.rating >= 4.5);
    }

    // 6. SORTING
    const sorted = sortCaregivers(filtered, filters.sortBy);
    
    return sorted;
  };

  const fetchCaregivers = async (location?: {lat: number, lng: number}, radiusOverride?: number, retryCount: number = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      // Use explicit radius if provided, otherwise use state
      const radiusToUse = radiusOverride !== undefined ? radiusOverride : selectedRadius;
      
      // Build query parameters - Remove _forceRefresh to reduce server load
      let queryParams = `limit=12&_cacheBust=${Date.now()}`;
      if (location) {
        queryParams += `&lat=${location.lat}&lng=${location.lng}&radius=${radiusToUse}`;
      }
      
      const response = await fetch(`/api/caregivers?${queryParams}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (!response.ok) {
        console.error('❌ API Response not OK:', response.status, response.statusText);
        throw new Error(`Failed to fetch caregivers: ${response.status} ${response.statusText}`);
      }
      
      let result;
      try {
        const responseText = await response.text();
        console.log('📝 Raw API Response length:', responseText.length);
        
        if (!responseText.trim()) {
          throw new Error('Empty response received');
        }
        
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError);
        console.error('📄 Response headers:', Object.fromEntries(response.headers.entries()));
        
        // Retry logic for JSON parse errors (up to 2 retries)
        if (retryCount < 2) {
          console.log(`🔄 Retrying request (attempt ${retryCount + 1}/2)...`);
          // Wait a moment before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 + retryCount * 1000));
          return fetchCaregivers(location, radiusOverride, retryCount + 1);
        }
        
        throw new Error(`Failed to parse API response: ${parseError}`);
      }
      
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
            bio: caregiver.bio, // Add bio field for CaregiverDetailModal
            experienceYears: caregiver.experienceYears || 0, // Add experience years
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
        
        // Store all caregivers for filtering
        setAllCaregivers(transformedCaregivers);
        
        // Apply filters and sorting
        const filtered = filterAndSortCaregivers(transformedCaregivers, activeFilters);
        setCaregivers(filtered);
      } else {
        throw new Error(result.error || 'Failed to load caregivers');
      }
    } catch (error) {
      console.error('Error fetching caregivers:', error);
      
      // Only set error state if this is not a retry (to avoid showing error during retries)
      if (retryCount === 0) {
        setError(error instanceof Error ? error.message : 'Failed to load caregivers');
      }
      
      setCaregivers([]);
      setAllCaregivers([]);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters whenever activeFilters changes
  useEffect(() => {
    if (allCaregivers.length > 0) {
      const filtered = filterAndSortCaregivers(allCaregivers, activeFilters);
      setCaregivers(filtered);
    }
  }, [activeFilters, allCaregivers]);

  const handleRadiusChange = (newRadius: number) => {
    setSelectedRadius(newRadius);
    if (userLocation) {
      // Pass the new radius explicitly to avoid state batching issues
      fetchCaregivers(userLocation, newRadius);
    }
  };

  const handleBadgeClick = () => {
    setShowSafetySection(true);
    // Hide after 5 seconds
    setTimeout(() => {
      setShowSafetySection(false);
    }, 5000);
  };

  return (
    <div className="">
      <Header 
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
      />
      <Banner onBadgeClick={handleBadgeClick} />

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
        {/* Trust & Safety Assurance Section - Conditionally shown */}
        {showSafetySection && (
          <section className="bg-gradient-to-r from-teal-50 via-amber-50 to-rose-50 dark:from-teal-950/30 dark:via-amber-950/30 dark:to-rose-950/30 border-y border-teal-100 dark:border-teal-900/50 py-12 animate-in slide-in-from-top duration-500 fade-in">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                Your Child's Safety Is Our #1 Priority
              </h2>
              <p className="text-gray-600 dark:text-gray-300 text-lg max-w-3xl mx-auto">
                Every caregiver on InstaCares undergoes comprehensive verification to ensure the highest standards of trust and safety.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Background Check - Teal Theme */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-teal-200 dark:border-teal-800 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Background Checked</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Comprehensive criminal background checks verified through official channels
                </p>
              </div>
              
              {/* ID Verification - Coral Theme */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-rose-200 dark:border-rose-800 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">ID Verified</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Government-issued photo ID verification ensures identity authenticity
                </p>
              </div>
              
              {/* Insurance Coverage - Purple Theme */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-purple-200 dark:border-purple-800 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Fully Insured</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Comprehensive liability insurance coverage for complete peace of mind
                </p>
              </div>
              
              {/* Review System - Amber Theme */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-amber-200 dark:border-amber-800 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-amber-600 dark:text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Parent Reviewed</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Real reviews from parents help you make informed childcare decisions
                </p>
              </div>
            </div>
            
            <div className="text-center mt-8">
              <div className="inline-flex items-center px-6 py-3 bg-teal-100 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-full shadow-sm">
                <svg className="w-5 h-5 text-teal-600 dark:text-teal-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-teal-800 dark:text-teal-200 font-medium text-sm">
                  100% of our caregivers complete verification before joining InstaCares
                </span>
              </div>
            </div>
          </div>
          </section>
        )}
        
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-2">
            <h2 className="text-black dark:text-white text-2xl font-semibold">Verified childcare providers near you</h2>
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
      <Footer />
    </div>
  );
}