"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdjustmentsHorizontalIcon, MapIcon, ListBulletIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import Header, { FilterState } from "../../components/Header";
import CaregiverCard, { Caregiver } from "../../components/CaregiverCard";
import CaregiverMap from "../../components/CaregiverMap";

// Canadian city coordinates for map centering
const CANADIAN_CITY_COORDINATES: Record<string, {lat: number, lng: number}> = {
  // Ontario
  'toronto': { lat: 43.6532, lng: -79.3832 },
  'toronto, on': { lat: 43.6532, lng: -79.3832 },
  'toronto, ontario': { lat: 43.6532, lng: -79.3832 },
  'kitchener': { lat: 43.4501, lng: -80.4829 },
  'kitchener, on': { lat: 43.4501, lng: -80.4829 },
  'kitchener, ontario': { lat: 43.4501, lng: -80.4829 },
  'hamilton': { lat: 43.2557, lng: -79.8711 },
  'hamilton, on': { lat: 43.2557, lng: -79.8711 },
  'hamilton, ontario': { lat: 43.2557, lng: -79.8711 },
  'waterloo': { lat: 43.4643, lng: -80.5204 },
  'waterloo, on': { lat: 43.4643, lng: -80.5204 },
  'london': { lat: 42.9849, lng: -81.2453 },
  'london, on': { lat: 42.9849, lng: -81.2453 },
  'ottawa': { lat: 45.4215, lng: -75.6972 },
  'ottawa, on': { lat: 45.4215, lng: -75.6972 },
  'mississauga': { lat: 43.5890, lng: -79.6441 },
  'brampton': { lat: 43.7315, lng: -79.7624 },
  'markham': { lat: 43.8561, lng: -79.3370 },
  
  // Quebec
  'montreal': { lat: 45.5017, lng: -73.5673 },
  'montreal, qc': { lat: 45.5017, lng: -73.5673 },
  'montreal, quebec': { lat: 45.5017, lng: -73.5673 },
  'quebec city': { lat: 46.8139, lng: -71.2080 },
  'quebec, qc': { lat: 46.8139, lng: -71.2080 },
  'laval': { lat: 45.6066, lng: -73.7124 },
  'gatineau': { lat: 45.4765, lng: -75.7013 },
  
  // British Columbia
  'vancouver': { lat: 49.2827, lng: -123.1207 },
  'vancouver, bc': { lat: 49.2827, lng: -123.1207 },
  'vancouver, british columbia': { lat: 49.2827, lng: -123.1207 },
  'burnaby': { lat: 49.2488, lng: -122.9805 },
  'richmond': { lat: 49.1666, lng: -123.1336 },
  'surrey': { lat: 49.1913, lng: -122.8490 },
  'victoria': { lat: 48.4284, lng: -123.3656 },
  'victoria, bc': { lat: 48.4284, lng: -123.3656 },
  
  // Alberta
  'calgary': { lat: 51.0447, lng: -114.0719 },
  'calgary, ab': { lat: 51.0447, lng: -114.0719 },
  'calgary, alberta': { lat: 51.0447, lng: -114.0719 },
  'edmonton': { lat: 53.5461, lng: -113.4938 },
  'edmonton, ab': { lat: 53.5461, lng: -113.4938 },
  'edmonton, alberta': { lat: 53.5461, lng: -113.4938 },
  
  // Manitoba
  'winnipeg': { lat: 49.8951, lng: -97.1384 },
  'winnipeg, mb': { lat: 49.8951, lng: -97.1384 },
  'winnipeg, manitoba': { lat: 49.8951, lng: -97.1384 },
  
  // Saskatchewan
  'saskatoon': { lat: 52.1579, lng: -106.6702 },
  'saskatoon, sk': { lat: 52.1579, lng: -106.6702 },
  'regina': { lat: 50.4452, lng: -104.6189 },
  'regina, sk': { lat: 50.4452, lng: -104.6189 },
  
  // Nova Scotia
  'halifax': { lat: 44.6488, lng: -63.5752 },
  'halifax, ns': { lat: 44.6488, lng: -63.5752 },
  'halifax, nova scotia': { lat: 44.6488, lng: -63.5752 },
  
  // New Brunswick
  'moncton': { lat: 46.0878, lng: -64.7782 },
  'moncton, nb': { lat: 46.0878, lng: -64.7782 },
  'fredericton': { lat: 45.9636, lng: -66.6431 },
  'saint john': { lat: 45.2734, lng: -66.0678 },
  
  // Newfoundland
  'st. john\'s': { lat: 47.5615, lng: -52.7126 },
  'st johns': { lat: 47.5615, lng: -52.7126 },
  'stjohns': { lat: 47.5615, lng: -52.7126 },
  
  // PEI
  'charlottetown': { lat: 46.2382, lng: -63.1311 },
  'charlottetown, pe': { lat: 46.2382, lng: -63.1311 },
  
  // Territories
  'yellowknife': { lat: 62.4540, lng: -114.3718 },
  'yellowknife, nt': { lat: 62.4540, lng: -114.3718 },
  'whitehorse': { lat: 60.7212, lng: -135.0568 },
  'iqaluit': { lat: 63.7467, lng: -68.5170 }
};

// Mock data - in a real app, this would come from an API
const mockCaregivers: Caregiver[] = [
  {
    id: "1",
    name: "Mackenzie MacDonald",
    image: null,
    rating: 4.9,
    reviewCount: 34,
    hourlyRate: 28,
    distance: "1.2 km",
    description: "Nova Scotia native with Red Cross First Aid certification. Specializes in outdoor activities and Maritime traditions. Loves beach walks and teaching kids about ocean life.",
    specialties: ["Outdoor Activities", "First Aid", "Swimming", "Maritime Culture"],
    location: {
      lat: 44.6488,
      lng: -63.5752,
      address: "Halifax Waterfront, Halifax, NS"
    },
    availability: "Available today",
    verified: true,
    experience: "6+ years experience"
  },
  {
    id: "2",
    name: "Amélie Tremblay",
    image: null,
    rating: 4.8,
    reviewCount: 29,
    hourlyRate: 26,
    distance: "0.9 km",
    description: "Bilingual Québécoise caregiver with early childhood education degree. Expert in French immersion and Canadian cultural activities. CPR certified.",
    specialties: ["Bilingual (FR/EN)", "Early Childhood Education", "Cultural Activities", "French Immersion"],
    location: {
      lat: 45.5017,
      lng: -73.5673,
      address: "Plateau Mont-Royal, Montreal, QC"
    },
    availability: "Available tomorrow",
    verified: true,
    experience: "8+ years experience"
  },
  {
    id: "3",
    name: "Connor O'Sullivan",
    image: null,
    rating: 4.7,
    reviewCount: 22,
    hourlyRate: 30,
    distance: "2.1 km",
    description: "Registered nurse from Newfoundland with pediatric experience. Specializes in special needs care and medical support. Patient and caring with excellent references.",
    specialties: ["Special Needs", "Medical Care", "Pediatric Nursing", "Emergency Response"],
    location: {
      lat: 47.5615,
      lng: -52.7126,
      address: "Downtown St. John's, NL"
    },
    availability: "Available this week",
    verified: true,
    experience: "12+ years experience"
  },
  {
    id: "4",
    name: "Priya Patel",
    image: null,
    rating: 4.9,
    reviewCount: 41,
    hourlyRate: 32,
    distance: "1.8 km",
    description: "Montessori-trained educator from Vancouver with multicultural experience. Fluent in English, Hindi, and Gujarati. Focuses on holistic child development.",
    specialties: ["Montessori Method", "Multicultural", "Holistic Development", "Multiple Languages"],
    location: {
      lat: 49.2827,
      lng: -123.1207,
      address: "Kitsilano, Vancouver, BC"
    },
    availability: "Monday-Friday",
    verified: true,
    experience: "10+ years experience"
  },
  {
    id: "5",
    name: "Tyler Sinclair",
    image: null,
    rating: 4.6,
    reviewCount: 18,
    hourlyRate: 25,
    distance: "3.2 km",
    description: "Former hockey coach and physical education teacher. Specializes in active play, sports, and outdoor adventures. Great with energetic kids and promoting healthy lifestyles.",
    specialties: ["Sports Coaching", "Active Play", "Hockey", "Physical Education"],
    location: {
      lat: 43.6532,
      lng: -79.3832,
      address: "Liberty Village, Toronto, ON"
    },
    availability: "Afternoons & weekends",
    verified: true,
    experience: "7+ years experience"
  },
  {
    id: "6",
    name: "Sarah Whitehorse",
    image: null,
    rating: 4.8,
    reviewCount: 15,
    hourlyRate: 35,
    distance: "2.8 km",
    description: "Indigenous caregiver specializing in traditional teachings and land-based learning. Incorporates Indigenous culture, storytelling, and connection to nature in childcare.",
    specialties: ["Indigenous Culture", "Land-based Learning", "Storytelling", "Traditional Arts"],
    location: {
      lat: 62.4540,
      lng: -114.3718,
      address: "Old Town, Yellowknife, NT"
    },
    availability: "Flexible schedule",
    verified: true,
    experience: "9+ years experience"
  },
  {
    id: "7",
    name: "Jean-Luc Bouchard",
    image: null,
    rating: 4.7,
    reviewCount: 26,
    distance: "1.5 km",
    description: "Acadian caregiver from New Brunswick with culinary arts background. Expert in French-Canadian traditions, cooking with kids, and bilingual education.",
    specialties: ["Culinary Arts", "Acadian Culture", "Bilingual Education", "Traditional Cooking"],
    location: {
      lat: 46.0878,
      lng: -64.7782,
      address: "Downtown Moncton, NB"
    },
    availability: "Weekday mornings",
    verified: true,
    experience: "5+ years experience"
  },
  {
    id: "8",
    name: "Kayla Running Bear",
    image: null,
    rating: 4.9,
    reviewCount: 33,
    hourlyRate: 27,
    distance: "4.1 km",
    description: "First Nations caregiver from Saskatchewan with child psychology background. Focuses on emotional wellness, traditional games, and cultural identity development.",
    specialties: ["Child Psychology", "Emotional Wellness", "First Nations Culture", "Traditional Games"],
    location: {
      lat: 52.1579,
      lng: -106.6702,
      address: "Riversdale, Saskatoon, SK"
    },
    availability: "Full-time available",
    verified: true,
    experience: "11+ years experience"
  },
  {
    id: "9",
    name: "Marcus Thompson",
    image: null,
    rating: 4.5,
    reviewCount: 20,
    hourlyRate: 24,
    distance: "3.7 km",
    description: "Prairie-raised caregiver with agricultural background. Teaches kids about farming, sustainability, and prairie life. Great with hands-on learning and outdoor education.",
    specialties: ["Agricultural Education", "Sustainability", "Outdoor Learning", "Prairie Culture"],
    location: {
      lat: 49.8951,
      lng: -97.1384,
      address: "Exchange District, Winnipeg, MB"
    },
    availability: "Weekends & evenings",
    verified: true,
    experience: "4+ years experience"
  },
  {
    id: "10",
    name: "Emma MacLeod",
    image: null,
    rating: 4.8,
    reviewCount: 37,
    hourlyRate: 29,
    distance: "2.3 km",
    description: "Island-born caregiver from PEI with music therapy certification. Specializes in therapeutic music, Anne of Green Gables storytelling, and coastal nature education.",
    specialties: ["Music Therapy", "Storytelling", "Coastal Education", "Island Culture"],
    location: {
      lat: 46.2382,
      lng: -63.1311,
      address: "Downtown Charlottetown, PE"
    },
    availability: "Available today",
    verified: true,
    experience: "8+ years experience"
  }
];

function SearchPageContent() {
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedCaregiver, setSelectedCaregiver] = useState<Caregiver | null>(null);
  const [hoveredCaregiver, setHoveredCaregiver] = useState<Caregiver | null>(null);
  // Removed showFilters state - now using Header's filter dropdown
  const [filteredCaregivers, setFilteredCaregivers] = useState<Caregiver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12; // 12 items for 4-column grid (3 rows)
  const [searchCriteria, setSearchCriteria] = useState({
    location: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
    infants: 0,
    children: 0
  });
  const [searchLocation, setSearchLocation] = useState<{lat: number, lng: number} | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [allCaregivers, setAllCaregivers] = useState<Caregiver[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterState>({
    priceRange: 'any',
    ageGroups: [],
    specialServices: [],
    experience: 'any',
    availability: [],
    highlyRated: false,
    sortBy: 'recommended'
  });

  // Function to get coordinates from search location
  const getCoordinatesFromLocation = (location: string): {lat: number, lng: number} | null => {
    if (!location) return null;
    
    const normalizedLocation = location.toLowerCase().trim();
    console.log(`🔍 Looking up coordinates for: "${location}" -> normalized: "${normalizedLocation}"`);
    
    // Try exact match first
    if (CANADIAN_CITY_COORDINATES[normalizedLocation]) {
      const coords = CANADIAN_CITY_COORDINATES[normalizedLocation];
      console.log(`✅ Found exact match for "${normalizedLocation}":`, coords);
      return coords;
    }
    
    // Try partial matches for cities without province
    for (const [key, coords] of Object.entries(CANADIAN_CITY_COORDINATES)) {
      if (key.includes(normalizedLocation) || normalizedLocation.includes(key.split(',')[0])) {
        console.log(`✅ Found partial match for "${normalizedLocation}" in key "${key}":`, coords);
        return coords;
      }
    }
    
    console.log(`❌ No coordinates found for "${normalizedLocation}"`);
    return null;
  };

  // Get user's browser location on mount
  useEffect(() => {
    console.log('🌍 Attempting to get user browser location...');
    
    // Always set a default location first (Toronto, Canada center)
    const defaultLocation = { lat: 43.6532, lng: -79.3832 };
    setUserLocation(defaultLocation);
    console.log('🗺️ Set default Toronto location for immediate caregiver loading');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          console.log('✅ Got user location:', location);
          setUserLocation(location);
          
          // Always set user location, searchLocation will be set from URL params if available
          console.log('🗺️ User location acquired for map centering');
        },
        (error) => {
          console.log('❌ Could not get user location:', error.message);
          console.log('🗺️ Continuing with default Toronto location - caregivers will still show');
          
          // Show a helpful message to the user
          if (error.code === error.PERMISSION_DENIED) {
            console.log('📍 Location access denied - showing all Canadian caregivers');
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            console.log('📍 Location unavailable - showing all Canadian caregivers');
          } else {
            console.log('📍 Location timeout or other error - showing all Canadian caregivers');
          }
          // Keep the default location we already set
        },
        {
          enableHighAccuracy: false, // Less strict for HTTP compatibility
          timeout: 5000, // Shorter timeout
          maximumAge: 600000 // 10 minutes
        }
      );
    } else {
      console.log('❌ Geolocation not supported - using default location');
    }
  }, []);

  // Fetch caregivers from API
  const fetchCaregivers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build query parameters - use searchLocation (from URL) or userLocation (from browser)  
      let queryParams = `_cacheBust=${Date.now()}&fixVersion=3`;
      const locationToUse = searchLocation || userLocation;
      if (locationToUse) {
        queryParams += `&lat=${locationToUse.lat}&lng=${locationToUse.lng}&radius=500`; // Use 500km radius for broader search
        console.log('🌍 Using location for API call:', locationToUse, searchLocation ? '(from URL)' : '(from browser)');
      } else {
        console.log('⚠️ No location available for API call - fetching all caregivers');
        // Don't add location parameters if no location is available - this will return all caregivers
      }
      
      const response = await fetch(`/api/caregivers?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch caregivers');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        // Transform API data to match Caregiver interface
        const apiCaregivers: Caregiver[] = result.data.map((caregiver: any) => {
          // Always include caregivers - don't filter by location data
          const hasLocationData = caregiver.address?.city;
          
          if (!hasLocationData) {
            console.log(`⚠️ Including caregiver ${caregiver.name} without complete location data:`, {
              city: caregiver.address?.city || 'Unknown City',
              lat: caregiver.address?.latitude,
              lng: caregiver.address?.longitude
            });
            // Don't return null - include the caregiver anyway
          }
          
          // Log when coordinates are missing (for debugging)
          if (!caregiver.address?.latitude || !caregiver.address?.longitude) {
            console.log(`📍 Caregiver ${caregiver.name} missing coordinates - including anyway:`, {
              city: caregiver.address?.city,
              hasLat: !!caregiver.address?.latitude,
              hasLng: !!caregiver.address?.longitude
            });
          }
          
          // Debug logging for Isabella specifically
          if (caregiver.name === 'Isabella Rodriguez') {
            console.log('🔧 Search Page Fix - Isabella Data:', {
              'caregiver.id (User ID)': caregiver.id,
              'caregiver.caregiverId (Caregiver Record ID)': caregiver.caregiverId,
              'Passing to CaregiverCard': {
                id: caregiver.id,
                caregiverId: caregiver.caregiverId
              }
            });
          }

          return {
            id: caregiver.id, // User ID for bookings
            caregiverId: caregiver.caregiverId, // Caregiver Record ID for availability queries
            name: caregiver.name,
            email: caregiver.email, // Add email for unique identification
            phone: caregiver.phone, // Add phone for additional identification
            city: caregiver.address.city, // Add city for location distinction
            image: caregiver.profilePhoto || caregiver.image || "/caregivers/default.svg",
            profilePhoto: caregiver.profilePhoto, // Preserve the profilePhoto field separately
            rating: caregiver.averageRating || 0,
            reviewCount: caregiver.totalBookings || 0,
            hourlyRate: caregiver.hourlyRate,
            distance: "0.8 km", // TODO: Calculate based on location
            description: caregiver.bio || "Experienced caregiver",
            bio: caregiver.bio, // Add bio field for CaregiverDetailModal
            experienceYears: caregiver.experienceYears || 0, // Add experience years
            specialties: caregiver.services?.map((s: any) => s.type) || ["General Care"],
            location: {
              lat: parseFloat(caregiver.address?.latitude) || 43.6532, // Default to Toronto coordinates
              lng: parseFloat(caregiver.address?.longitude) || -79.3832,
              address: `${caregiver.address?.city || 'Toronto'}, ${caregiver.address?.province || 'ON'}`
            },
            availability: caregiver.availability || "No Availability Posted Yet",
            availabilitySlots: caregiver.availabilitySlots || [],
            hasAvailability: caregiver.hasAvailability || false,
            verified: caregiver.isVerified,
            experience: `${caregiver.experienceYears || 0}+ years experience`
          };
        }).filter(Boolean); // Remove null entries
        
        
        console.log(`✅ Successfully loaded ${apiCaregivers.length} caregivers`);
        setAllCaregivers(apiCaregivers);
        setFilteredCaregivers(apiCaregivers);
      }
    } catch (error) {
      console.error('Error fetching caregivers:', error.message);
      setError('Failed to load caregivers. Please try again.');
      // Use mock data as fallback when API fails
      console.log('🔄 Using mock data as fallback');
      setAllCaregivers(mockCaregivers);
      setFilteredCaregivers(mockCaregivers);
    } finally {
      setLoading(false);
    }
  };

  // Load caregivers on component mount - always fetch immediately
  useEffect(() => {
    console.log('🚀 Component mounted - fetching caregivers immediately');
    fetchCaregivers();
  }, []);

  // Refetch caregivers when either search location or user location changes
  // But don't wait for location - always show caregivers
  useEffect(() => {
    if (userLocation || searchLocation) {
      console.log('📍 Location updated - refetching caregivers');
      fetchCaregivers();
    }
  }, [searchLocation, userLocation]);

  // Apply filters whenever search criteria or active filters change
  useEffect(() => {
    if (allCaregivers.length > 0) {
      const filtered = filterCaregivers(searchCriteria, activeFilters);
      setFilteredCaregivers(filtered);
      setCurrentPage(1); // Reset to first page when filters change
    }
  }, [allCaregivers, searchCriteria, activeFilters]);

  // Parse URL parameters and set search criteria
  useEffect(() => {
    if (!searchParams) return;
    
    const location = searchParams.get('location') || '';
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const infants = parseInt(searchParams.get('infants') || '0');
    const children = parseInt(searchParams.get('children') || '0');

    const criteria = {
      location,
      startDate: startDateStr ? new Date(startDateStr) : null,
      endDate: endDateStr ? new Date(endDateStr) : null,
      infants,
      children
    };

    setSearchCriteria(criteria);
    
    // Set search location coordinates for map centering
    if (location) {
      const coordinates = getCoordinatesFromLocation(location);
      setSearchLocation(coordinates);
      console.log(`🗺️ Search location "${location}" mapped to:`, coordinates);
    } else {
      console.log('🗺️ No search location provided, clearing search location');
      setSearchLocation(null);
    }
  }, [searchParams]);

  // Sorting logic
  const sortCaregivers = (caregivers: Caregiver[], sortBy: string): Caregiver[] => {
    const sorted = [...caregivers];
    
    switch (sortBy) {
      case 'price-low':
        return sorted.sort((a, b) => a.hourlyRate - b.hourlyRate);
      
      case 'price-high':
        return sorted.sort((a, b) => b.hourlyRate - a.hourlyRate);
      
      case 'rating-high':
        return sorted.sort((a, b) => {
          // Sort by rating first, then by review count for tie-breaking
          const ratingDiff = b.rating - a.rating;
          if (ratingDiff !== 0) return ratingDiff;
          return b.reviewCount - a.reviewCount;
        });
      
      case 'reviews-most':
        return sorted.sort((a, b) => b.reviewCount - a.reviewCount);
      
      case 'newest':
        // For now, reverse the current order (newest first)
        // In a real app, this would sort by registration date
        return sorted.reverse();
      
      case 'recommended':
      default:
        // Recommended sorting: blend of rating, reviews, and availability
        return sorted.sort((a, b) => {
          // Calculate recommendation score
          const scoreA = (a.rating * 0.4) + (Math.min(a.reviewCount / 10, 5) * 0.3) + (a.verified ? 2 : 0) + (a.availability.includes('Available') ? 1 : 0);
          const scoreB = (b.rating * 0.4) + (Math.min(b.reviewCount / 10, 5) * 0.3) + (b.verified ? 2 : 0) + (b.availability.includes('Available') ? 1 : 0);
          return scoreB - scoreA;
        });
    }
  };

  // Comprehensive filtering logic
  const filterCaregivers = (criteria: typeof searchCriteria, filters: FilterState) => {
    let filtered = [...allCaregivers];

    console.log('🔍 Starting filter with', filtered.length, 'caregivers');
    console.log('📍 Search criteria:', criteria);
    console.log('🎛️ Active filters:', filters);

    // 1. LOCATION FILTERING - Only apply when user explicitly searches for a city
    if (criteria.location && criteria.location.trim()) {
      const searchLocation = criteria.location.toLowerCase().trim();
      console.log('🔍 Searching for location:', `"${searchLocation}"`);
      
      const beforeCount = filtered.length;
      filtered = filtered.filter(caregiver => {
        const caregiverCity = caregiver.city?.toLowerCase() || '';
        const caregiverAddress = caregiver.location?.address?.toLowerCase() || '';
        
        // Debug each caregiver's location data
        console.log(`👤 Checking caregiver: ${caregiver.name}`);
        console.log(`   City: "${caregiverCity}"`);
        console.log(`   Address: "${caregiverAddress}"`);
        
        // Extract city name from search (remove province abbreviations)
        const searchCity = searchLocation
          .replace(/,\s*(on|ontario|qc|quebec|bc|british columbia|ab|alberta|mb|manitoba|sk|saskatchewan|ns|nova scotia|nb|new brunswick|nl|newfoundland|pe|prince edward island|nt|northwest territories|nu|nunavut|yt|yukon)$/i, '')
          .trim();
        
        console.log(`   Searching for city: "${searchCity}"`);
        
        // Check if caregiver's city matches the searched city
        const cityMatches = caregiverCity === searchCity || 
                           caregiverCity.includes(searchCity) ||
                           caregiverAddress.startsWith(searchCity);
        
        // Additional specific city mappings for common variations
        const specificMatches = 
          (searchCity === 'toronto' && (caregiverCity.includes('toronto') || caregiverAddress.includes('toronto'))) ||
          (searchCity === 'kitchener' && (caregiverCity.includes('kitchener') || caregiverAddress.includes('kitchener'))) ||
          (searchCity === 'montreal' && (caregiverCity.includes('montreal') || caregiverAddress.includes('montreal'))) ||
          (searchCity === 'vancouver' && (caregiverCity.includes('vancouver') || caregiverAddress.includes('vancouver'))) ||
          (searchCity === 'calgary' && (caregiverCity.includes('calgary') || caregiverAddress.includes('calgary'))) ||
          (searchCity === 'ottawa' && (caregiverCity.includes('ottawa') || caregiverAddress.includes('ottawa'))) ||
          (searchCity === 'hamilton' && (caregiverCity.includes('hamilton') || caregiverAddress.includes('hamilton')));
        
        const matchFound = cityMatches || specificMatches;
        
        if (matchFound) {
          console.log(`   ✅ MATCH found: cityMatches=${cityMatches}, specificMatches=${specificMatches}`);
        } else {
          console.log(`   ❌ NO MATCH: "${caregiverCity}" does not match "${searchCity}"`);
        }
        
        console.log(`   Result: ${matchFound ? '✅ INCLUDED' : '❌ EXCLUDED'}`);
        console.log('');
        
        return matchFound;
      });
      
      console.log(`📍 Location filter: ${beforeCount} → ${filtered.length} caregivers (removed ${beforeCount - filtered.length})`);
    }

    // 2. PRICE RANGE FILTERING
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
      console.log('💰 After price filter:', filtered.length, 'caregivers');
    }

    // 3. AGE GROUP FILTERING
    const hasInfants = criteria.infants > 0 || filters.ageGroups.includes('infants');
    const hasToddlers = filters.ageGroups.includes('toddlers');
    const hasSchoolAge = criteria.children > 0 || filters.ageGroups.includes('schoolage');
    const hasTeens = filters.ageGroups.includes('teens');

    if (hasInfants || hasToddlers || hasSchoolAge || hasTeens) {
      filtered = filtered.filter(caregiver => {
        const specialties = caregiver.specialties.map(s => s.toLowerCase());
        const description = caregiver.description.toLowerCase();
        
        // Check if caregiver works with requested age groups
        let ageMatch = false;
        
        if (hasInfants) {
          ageMatch = ageMatch || specialties.some(s => 
            s.includes('infant') || s.includes('baby') || s.includes('newborn') || s.includes('0-2')
          ) || description.includes('infant') || description.includes('baby');
        }
        
        if (hasToddlers) {
          ageMatch = ageMatch || specialties.some(s => 
            s.includes('toddler') || s.includes('2-4') || s.includes('early childhood')
          ) || description.includes('toddler');
        }
        
        if (hasSchoolAge) {
          ageMatch = ageMatch || specialties.some(s => 
            s.includes('school') || s.includes('5-12') || s.includes('homework') || s.includes('education')
          ) || description.includes('school');
        }
        
        if (hasTeens) {
          ageMatch = ageMatch || specialties.some(s => 
            s.includes('teen') || s.includes('13+') || s.includes('adolescent')
          ) || description.includes('teen');
        }
        
        // If no specific age requirements, include all caregivers
        if (!hasInfants && !hasToddlers && !hasSchoolAge && !hasTeens) {
          ageMatch = true;
        }
        
        return ageMatch;
      });
      console.log('👶 After age group filter:', filtered.length, 'caregivers');
    }

    // 4. SPECIAL SERVICES FILTERING
    if (filters.specialServices.length > 0) {
      filtered = filtered.filter(caregiver => {
        const specialties = caregiver.specialties.map(s => s.toLowerCase());
        const description = caregiver.description.toLowerCase();
        
        return filters.specialServices.some(service => {
          switch (service) {
            case 'special-needs':
              return specialties.some(s => s.includes('special needs') || s.includes('special') || s.includes('medical')) ||
                     description.includes('special needs') || description.includes('medical');
            case 'bilingual':
              return specialties.some(s => s.includes('bilingual') || s.includes('french') || s.includes('language')) ||
                     description.includes('bilingual') || description.includes('french');
            case 'homework':
              return specialties.some(s => s.includes('homework') || s.includes('education') || s.includes('tutoring')) ||
                     description.includes('homework') || description.includes('education');
            case 'meals':
              return specialties.some(s => s.includes('meal') || s.includes('cooking') || s.includes('culinary')) ||
                     description.includes('meal') || description.includes('cooking');
            case 'housekeeping':
              return specialties.some(s => s.includes('housekeeping') || s.includes('cleaning')) ||
                     description.includes('housekeeping') || description.includes('cleaning');
            case 'transportation':
              return specialties.some(s => s.includes('transportation') || s.includes('driving')) ||
                     description.includes('transportation') || description.includes('driving');
            default:
              return false;
          }
        });
      });
      console.log('⭐ After special services filter:', filtered.length, 'caregivers');
    }

    // 5. EXPERIENCE LEVEL FILTERING
    if (filters.experience !== 'any') {
      filtered = filtered.filter(caregiver => {
        const experienceText = caregiver.experience || '';
        const experienceYears = parseInt(experienceText.match(/\d+/)?.[0] || '0');
        
        switch (filters.experience) {
          case 'new': return experienceYears >= 0 && experienceYears <= 2;
          case 'experienced': return experienceYears >= 3 && experienceYears <= 7;
          case 'expert': return experienceYears >= 8;
          default: return true;
        }
      });
      console.log('🌟 After experience filter:', filtered.length, 'caregivers');
    }

    // 6. HIGHLY RATED FILTERING
    if (filters.highlyRated) {
      filtered = filtered.filter(caregiver => caregiver.rating >= 4.5);
      console.log('⭐ After highly rated filter:', filtered.length, 'caregivers');
    }

    // 7. AVAILABILITY FILTERING (simulated for now)
    if (filters.availability.length > 0) {
      // In a real implementation, this would check actual availability
      // For now, we'll use a simple heuristic based on availability text
      filtered = filtered.filter(caregiver => {
        const availability = caregiver.availability?.toLowerCase() || '';
        
        return filters.availability.some(availType => {
          switch (availType) {
            case 'available-today':
              return availability.includes('available today') || availability.includes('available now');
            case 'this-week':
              return availability.includes('week') || availability.includes('available');
            case 'weekdays':
              return availability.includes('weekday') || availability.includes('monday') || availability.includes('full-time');
            case 'weekends':
              return availability.includes('weekend') || availability.includes('saturday') || availability.includes('sunday');
            case 'evenings':
              return availability.includes('evening') || availability.includes('afternoon');
            case 'overnight':
              return availability.includes('overnight') || availability.includes('night');
            default:
              return true;
          }
        });
      });
      console.log('⚡ After availability filter:', filtered.length, 'caregivers');
    }

    console.log('✅ Final filtered result:', filtered.length, 'caregivers');
    
    // 8. SORTING
    const sorted = sortCaregivers(filtered, filters.sortBy);
    console.log('🔄 Applied sorting:', filters.sortBy);
    
    return sorted;
  };

  const handleCaregiverSelect = (caregiver: Caregiver) => {
    setSelectedCaregiver(caregiver);
  };

  const formatSearchSummary = () => {
    const parts = [];
    if (searchCriteria.location) parts.push(searchCriteria.location);
    if (searchCriteria.startDate && searchCriteria.endDate) {
      parts.push(`${searchCriteria.startDate.toLocaleDateString()} - ${searchCriteria.endDate.toLocaleDateString()}`);
    }
    const totalChildren = searchCriteria.infants + searchCriteria.children;
    if (totalChildren > 0) {
      parts.push(`${totalChildren} child${totalChildren > 1 ? 'ren' : ''}`);
    }
    return parts.join(' • ');
  };

  // Test filter functions for demonstration
  const handleTestFilters = () => {
    console.log('🧪 Testing filters...');
    
    // Test location filter
    setActiveFilters(prev => ({ ...prev, priceRange: '25-35' }));
    
    // Simulate different filter combinations
    setTimeout(() => {
      setActiveFilters(prev => ({ 
        ...prev, 
        ageGroups: ['infants', 'toddlers'],
        specialServices: ['bilingual'],
        experience: 'experienced'
      }));
    }, 2000);
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header 
        activeFilters={activeFilters}
        onFiltersChange={setActiveFilters}
      />
      
      {/* Collapsible Details Bar - Show when filters are active */}
      {Object.values(activeFilters).some(f => 
        Array.isArray(f) ? f.length > 0 : f !== 'any'
      ) && (
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-green-100 dark:bg-green-900 rounded-md flex items-center justify-center">
                    <MapIcon className="h-3 w-3 text-green-600 dark:text-green-400" />
                  </div>
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {searchCriteria.location ? `Childcare in ${searchCriteria.location}` : 'Childcare Providers Across Canada'}
                  </h1>
                  {!searchCriteria.location && !userLocation && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                      Showing all available caregivers
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <div className="flex items-center text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {filteredCaregivers.length}
                    </span>
                    <span className="ml-1">available ({allCaregivers.length} total)</span>
                  </div>
                  <button 
                    onClick={handleTestFilters}
                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition"
                  >
                    🧪 Test Filters
                  </button>
                  {(activeFilters.priceRange !== 'any' || activeFilters.ageGroups.length > 0 || 
                    activeFilters.specialServices.length > 0 || activeFilters.experience !== 'any' ||
                    activeFilters.availability.length > 0 || activeFilters.highlyRated || activeFilters.sortBy !== 'recommended') && (
                    <button 
                      onClick={() => setActiveFilters({
                        priceRange: 'any',
                        ageGroups: [],
                        specialServices: [],
                        experience: 'any',
                        availability: [],
                        highlyRated: false,
                        sortBy: 'recommended'
                      })}
                      className="px-3 py-1 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition"
                    >
                      Clear Filters
                    </button>
                  )}
                  {formatSearchSummary() && (
                    <div className="flex items-center text-gray-500 dark:text-gray-400">
                      <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                      <span>{formatSearchSummary()}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* View Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center px-2 py-1.5 rounded text-xs font-medium transition ${
                    viewMode === 'list' 
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <ListBulletIcon className="h-3 w-3 mr-1" />
                  List
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`flex items-center px-2 py-1.5 rounded text-xs font-medium transition ${
                    viewMode === 'map' 
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <MapIcon className="h-3 w-3 mr-1" />
                  Map
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Old filters panel removed - now using Header's advanced filter dropdown */}

      {/* Main Content - Takes remaining space */}
      <div className="flex flex-1 overflow-hidden">
        {viewMode === 'list' ? (
          <>
            {/* Caregiver Cards - Left Side (65% width) */}
            <div className="w-[65%] h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading caregivers...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">⚠️</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error loading caregivers</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mb-4">{error}</p>
                    <button 
                      onClick={fetchCaregivers}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : filteredCaregivers.length > 0 ? (
                <>
                  {/* Pagination calculations */}
                  {(() => {
                    const totalPages = Math.ceil(filteredCaregivers.length / itemsPerPage);
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = Math.min(startIndex + itemsPerPage, filteredCaregivers.length);
                    const paginatedCaregivers = filteredCaregivers.slice(startIndex, endIndex);
                    
                    return (
                      <>
                        <div className="grid grid-cols-4 gap-4">
                          {paginatedCaregivers.map((caregiver) => (
                            <CaregiverCard
                              key={caregiver.id}
                              caregiver={caregiver}
                              onHover={setHoveredCaregiver}
                              isSelected={selectedCaregiver?.id === caregiver.id}
                            />
                          ))}
                        </div>
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                          <div className="mt-8 flex items-center justify-between">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Showing {startIndex + 1}-{endIndex} of {filteredCaregivers.length} caregivers
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {/* Previous button */}
                              <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 shadow-sm ${
                                  currentPage === 1
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600 shadow-none'
                                    : 'bg-white text-gray-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-gray-200 hover:shadow-md dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-300 dark:hover:border-rose-700'
                                }`}
                              >
                                <ChevronLeftIcon className="h-4 w-4 mr-1.5" />
                                Previous
                              </button>
                              
                              {/* Page numbers */}
                              <div className="flex items-center gap-2">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                                  // Show first, last, current, and adjacent pages
                                  if (
                                    page === 1 ||
                                    page === totalPages ||
                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                  ) {
                                    return (
                                      <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`min-w-[44px] h-11 px-3 text-sm font-semibold rounded-xl transition-all duration-200 shadow-sm ${
                                          currentPage === page
                                            ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/25 hover:shadow-xl hover:shadow-rose-500/30 transform hover:scale-105'
                                            : 'bg-white text-gray-700 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-gray-200 hover:shadow-md dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-300 dark:hover:border-rose-700'
                                        }`}
                                      >
                                        {page}
                                      </button>
                                    );
                                  }
                                  
                                  // Show ellipsis for gaps
                                  if (page === currentPage - 2 || page === currentPage + 2) {
                                    return (
                                      <span key={page} className="px-2 text-gray-400 dark:text-gray-500 font-medium">
                                        •••
                                      </span>
                                    );
                                  }
                                  
                                  return null;
                                })}
                              </div>
                              
                              {/* Next button */}
                              <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 shadow-sm ${
                                  currentPage === totalPages
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-600 shadow-none'
                                    : 'bg-white text-gray-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-gray-200 hover:shadow-md dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-300 dark:hover:border-rose-700'
                                }`}
                              >
                                Next
                                <ChevronRightIcon className="h-4 w-4 ml-1.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🔍</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No providers found</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
                      Try adjusting your search criteria or location to find more childcare providers across Canada.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Map - Right Side (35% width) */}
            <div className="w-[35%] h-full">
              <CaregiverMap
                caregivers={filteredCaregivers}
                selectedCaregiver={hoveredCaregiver || selectedCaregiver}
                onCaregiverSelect={handleCaregiverSelect}
                searchLocation={searchLocation || userLocation}
              />
            </div>
          </>
        ) : (
          // Full Map View
          <div className="w-full h-full">
            <CaregiverMap
              caregivers={filteredCaregivers}
              selectedCaregiver={selectedCaregiver}
              onCaregiverSelect={handleCaregiverSelect}
              searchLocation={searchLocation || userLocation}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading search...</p>
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}