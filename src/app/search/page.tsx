"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { AdjustmentsHorizontalIcon, MapIcon, ListBulletIcon, ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import Header, { FilterState } from "../../components/Header";
import CaregiverCard, { Caregiver } from "../../components/CaregiverCard";
import BabysitterCard, { BabysitterCardData } from "../../components/BabysitterCard";
import { geocodeLocation } from "@/lib/geocoding";
import { MapViewport, getRadiusFromZoom } from "../../components/CaregiverMap";

// Dynamic import for CaregiverMap to reduce initial bundle size (944KB Mapbox GL)
const CaregiverMap = dynamic(() => import("../../components/CaregiverMap"), {
  loading: () => (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading map...</p>
      </div>
    </div>
  ),
  ssr: false // Mapbox requires browser APIs
});

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
    caregiverId: "caregiver-1",
    name: "Mackenzie MacDonald",
    image: '',
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
    caregiverId: "caregiver-2",
    name: "Amélie Tremblay",
    image: '',
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
    caregiverId: "caregiver-3",
    name: "Connor O'Sullivan",
    image: '',
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
    caregiverId: "caregiver-4",
    name: "Priya Patel",
    image: '',
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
    caregiverId: "caregiver-5",
    name: "Tyler Sinclair",
    image: '',
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
    caregiverId: "caregiver-6",
    name: "Sarah Whitehorse",
    image: '',
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
    caregiverId: "caregiver-7",
    name: "Jean-Luc Bouchard",
    image: '',
    rating: 4.7,
    reviewCount: 26,
    hourlyRate: 25,
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
    caregiverId: "caregiver-8",
    name: "Kayla Running Bear",
    image: '',
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
    caregiverId: "caregiver-9",
    name: "Marcus Thompson",
    image: '',
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
    caregiverId: "caregiver-10",
    name: "Emma MacLeod",
    image: '',
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


// Haversine formula to calculate distance between two coordinates in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

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
  const [allBabysitters, setAllBabysitters] = useState<BabysitterCardData[]>([]);
  const [showCaregiverContactInfo, setShowCaregiverContactInfo] = useState<boolean>(false);

  // Dynamic map search state
  const [searchAsIMove, setSearchAsIMove] = useState<boolean>(true); // Default ON as per spec
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null);
  const [isMapFiltering, setIsMapFiltering] = useState<boolean>(false); // For loading UI (cards go gray)
  const [mapFilteredCaregivers, setMapFilteredCaregivers] = useState<Caregiver[]>([]);
  const [mapAreaCount, setMapAreaCount] = useState<number>(0); // Count in visible area
  const [hasInitialMapFilter, setHasInitialMapFilter] = useState<boolean>(false); // Track if initial filter applied

  const [activeFilters, setActiveFilters] = useState<FilterState>({
    providerType: 'all',
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
            reviewCount: caregiver.reviewCount || 0,
            hourlyRate: caregiver.hourlyRate,
            distance: "0.8 km", // TODO: Calculate based on location
            description: caregiver.bio || "Experienced caregiver",
            bio: caregiver.bio, // Add bio field for CaregiverDetailModal
            experienceYears: caregiver.experienceYears || 0, // Add experience years
            specialties: caregiver.specialties || [],
            location: {
              lat: parseFloat(caregiver.address?.latitude) || 43.6532, // Default to Toronto coordinates
              lng: parseFloat(caregiver.address?.longitude) || -79.3832,
              address: `${caregiver.address?.city || 'Toronto'}, ${caregiver.address?.province || 'ON'}`
            },
            availability: caregiver.availability || "No Availability Posted Yet",
            availabilitySlots: caregiver.availabilitySlots || [],
            hasAvailability: caregiver.hasAvailability || false,
            verified: caregiver.isVerified,
            stripeAccountId: caregiver.stripeAccountId,
            stripeOnboarded: caregiver.stripeOnboarded,
            canReceivePayments: caregiver.canReceivePayments,
            experience: `${caregiver.experienceYears || 0}+ years experience`,
            services: caregiver.services || [] // Services offered by caregiver
          };
        }).filter(Boolean); // Remove null entries
        
        
        console.log(`✅ Successfully loaded ${apiCaregivers.length} caregivers`);
        setShowCaregiverContactInfo(result.showCaregiverContactInfo || false);
        console.log("🔧 showCaregiverContactInfo from API:", result.showCaregiverContactInfo);
        setAllCaregivers(apiCaregivers);
        setFilteredCaregivers(apiCaregivers);
      }
    } catch (error) {
      console.error('Error fetching caregivers:', error instanceof Error ? error.message : error);
      setError('Failed to load caregivers. Please try again.');
      // Use mock data as fallback when API fails
      console.log('🔄 Using mock data as fallback');
      setAllCaregivers(mockCaregivers);
      setFilteredCaregivers(mockCaregivers);
    } finally {
      setLoading(false);
    }
  };

  // Fetch babysitters for mixed results
  const fetchBabysitters = async () => {
    try {
      const response = await fetch('/api/babysitters?limit=20&sortBy=rating', {
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.babysitters) {
          setAllBabysitters(data.babysitters.map((b: any) => ({ ...b, type: 'babysitter' as const })));
        }
      }
    } catch (error) {
      console.error('Error fetching babysitters:', error);
    }
  };

  // Load caregivers on component mount - always fetch immediately
  useEffect(() => {
    console.log('🚀 Component mounted - fetching caregivers immediately');
    fetchCaregivers();
    fetchBabysitters();
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

  // Handle map viewport change - filter caregivers based on visible map area
  const handleMapViewportChange = (viewport: MapViewport) => {
    console.log('🗺️ Map viewport changed:', viewport);
    setMapViewport(viewport);

    if (!searchAsIMove) {
      console.log('🔒 Search as I move is OFF - skipping filter');
      return;
    }

    // Show loading state (cards go gray)
    setIsMapFiltering(true);

    // Calculate radius based on zoom level
    const radius = getRadiusFromZoom(viewport.zoom);
    console.log(`📏 Calculated radius from zoom ${viewport.zoom}: ${radius}km`);

    // Filter caregivers within the visible map area
    const caregiversInView = allCaregivers.filter(caregiver => {
      const caregiverLat = caregiver.location?.lat;
      const caregiverLng = caregiver.location?.lng;

      if (!caregiverLat || !caregiverLng) return false;

      // Calculate distance from map center
      const distance = calculateDistance(
        viewport.latitude,
        viewport.longitude,
        caregiverLat,
        caregiverLng
      );

      return distance <= radius;
    });

    // Sort by distance from map center
    const sortedCaregivers = caregiversInView
      .map(caregiver => ({
        ...caregiver,
        distanceFromCenter: calculateDistance(
          viewport.latitude,
          viewport.longitude,
          caregiver.location?.lat || 0,
          caregiver.location?.lng || 0
        )
      }))
      .sort((a, b) => a.distanceFromCenter - b.distanceFromCenter);

    console.log(`📍 Found ${sortedCaregivers.length} caregivers within ${radius}km of map center`);

    // Update map area count
    setMapAreaCount(sortedCaregivers.length);

    // Apply existing filters on top of map filter
    const fullyFiltered = filterCaregivers(searchCriteria, activeFilters, sortedCaregivers);
    setMapFilteredCaregivers(fullyFiltered);
    setFilteredCaregivers(fullyFiltered);
    setCurrentPage(1); // Reset to first page

    // Clear loading state after a short delay for visual feedback
    setTimeout(() => {
      setIsMapFiltering(false);
      // Mark that initial map filter has been applied
      if (!hasInitialMapFilter) {
        setHasInitialMapFilter(true);
      }
    }, 150);
  };

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
      // Use Mapbox geocoding API to get accurate coordinates
      geocodeLocation(location).then(result => {
        if (result) {
          setSearchLocation({ lat: result.lat, lng: result.lng });
          console.log("Geocoded location:", result);
        } else {
          // Fallback to hardcoded coordinates if geocoding fails
          const fallbackCoords = getCoordinatesFromLocation(location);
          setSearchLocation(fallbackCoords);
          console.log("Using fallback coords:", fallbackCoords);
        }
      }).catch(err => {
        console.error("Geocoding error:", err);
        // Use fallback on error
        const fallbackCoords = getCoordinatesFromLocation(location);
        setSearchLocation(fallbackCoords);
      });
    } else {
      console.log("No search location provided, clearing search location");
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
  const filterCaregivers = (criteria: typeof searchCriteria, filters: FilterState, sourceArray?: Caregiver[]) => {
    let filtered = sourceArray ? [...sourceArray] : [...allCaregivers];

    console.log('🔍 Starting filter with', filtered.length, 'caregivers');
    console.log('📍 Search criteria:', criteria);
    console.log('🎛️ Active filters:', filters);

    // 1. LOCATION FILTERING - Use geocoding with radius-based search
    if (criteria.location && criteria.location.trim()) {
      console.log('🔍 Location search:', criteria.location);
      console.log('🗺️ Geocoded coords:', searchLocation);
      
      if (searchLocation && searchLocation.lat && searchLocation.lng) {
        const searchRadius = 20; // 20km radius
        console.log();
        
        const beforeCount = filtered.length;
        filtered = filtered.filter(caregiver => {
          // Get caregiver coordinates
          const caregiverLat = caregiver.location?.lat;
          const caregiverLng = caregiver.location?.lng;
          
          if (!caregiverLat || !caregiverLng) {
            console.log();
            return false;
          }
          
          // Calculate distance using Haversine formula
          const distance = calculateDistance(
            searchLocation.lat,
            searchLocation.lng,
            caregiverLat,
            caregiverLng
          );
          
          const withinRadius = distance <= searchRadius;
          console.log();
          
          return withinRadius;
        });
        
        console.log();
      } else {
        console.log('⚠️  No geocoded coordinates available, skipping location filter');
      }
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

    // 4. DATE/AVAILABILITY FILTERING - Filter by actual availability slots
    if (criteria.startDate && criteria.endDate) {
      const requestStart = new Date(criteria.startDate);
      const requestEnd = new Date(criteria.endDate);

      console.log(`📅 Filtering by dates: ${requestStart.toLocaleDateString()} - ${requestEnd.toLocaleDateString()}`);

      const beforeCount = filtered.length;
      filtered = filtered.filter(caregiver => {
        if (!caregiver.availabilitySlots || caregiver.availabilitySlots.length === 0) {
          console.log(`  ❌ ${caregiver.name}: No availability slots posted`);
          return false;
        }

        // Debug logging for all caregivers
        console.log(`  🔍 ${caregiver.name}: Checking ${caregiver.availabilitySlots.length} slots`);

        const hasMatchingSlots = caregiver.availabilitySlots.some(slot => {
          // Parse slot date - handles both ISO strings and Date objects
          let slotDate: Date;
          if (typeof slot.date === 'string') {
            // If it's a numeric string (Unix timestamp), parse as number
            if (/^\d+$/.test(slot.date)) {
              slotDate = new Date(parseInt(slot.date));
            } else {
              // Otherwise treat as ISO date string
              slotDate = new Date(slot.date);
            }
          } else {
            console.log(`  ⚠️ ${caregiver.name}: Invalid slot date format:`, slot.date);
            return false;
          }

          const dateMatches = slotDate >= requestStart && slotDate <= requestEnd;
          const hasCapacity = slot.availableSpots > 0;
          const isAvailable = slot.status === 'AVAILABLE';

          const matches = dateMatches && hasCapacity && isAvailable;

          if (dateMatches) {
            console.log(`    ${matches ? '✅' : '⚠️'} Slot ${slotDate.toLocaleDateString()}: spots=${slot.availableSpots}, status=${slot.status}`);
          }

          return matches;
        });

        if (!hasMatchingSlots) {
          console.log(`  ❌ ${caregiver.name}: No matching availability slots`);
        } else {
          console.log(`  ✅ ${caregiver.name}: Has matching slots!`);
        }

        return hasMatchingSlots;
      });

      console.log(`📅 After date/availability filter: ${beforeCount} → ${filtered.length} caregivers`);
    }

    // 5. SPECIAL SERVICES FILTERING
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
      
      {/* HIDDEN FOR NOW - Collapsible Details Bar - Show when filters are active */}
      {/*
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
                    <span className="ml-1">
                      {searchAsIMove && mapViewport ? 'in this area' : 'available'} ({allCaregivers.length} total)
                    </span>
                  </div>
                  <label className="flex items-center cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={searchAsIMove}
                        onChange={(e) => setSearchAsIMove(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-8 h-4 rounded-full transition-colors ${searchAsIMove ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                      <div className={`absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${searchAsIMove ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                    <span className="ml-2 text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200">
                      Search as I move
                    </span>
                  </label>
                  <button
                    onClick={handleTestFilters}
                    className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition"
                  >
                    🧪 Test Filters
                  </button>
                  {(activeFilters.providerType !== 'all' || activeFilters.priceRange !== 'any' || activeFilters.ageGroups.length > 0 ||
                    activeFilters.specialServices.length > 0 || activeFilters.experience !== 'any' ||
                    activeFilters.availability.length > 0 || activeFilters.highlyRated || activeFilters.sortBy !== 'recommended') && (
                    <button
                      onClick={() => setActiveFilters({
                        providerType: 'all',
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
      */}

      {/* Old filters panel removed - now using Header's advanced filter dropdown */}

      {/* Main Content - Takes remaining space */}
      <div className="flex flex-col-reverse lg:flex-row flex-1 overflow-hidden">
        {viewMode === 'list' ? (
          <>
            {/* Caregiver Cards - Left Side (65% width on desktop, full width on mobile) */}
            <div className="w-full lg:w-[65%] h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 relative">
              {(loading || (searchAsIMove && !hasInitialMapFilter && allCaregivers.length > 0)) ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">
                      {loading ? 'Loading caregivers...' : 'Finding caregivers in your area...'}
                    </p>
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
              ) : (() => {
                // Filter babysitters based on active filters
                const showBabysitters = activeFilters.providerType !== 'caregivers';
                const showCaregiversOnly = activeFilters.providerType === 'babysitters';
                let searchFilteredBabysitters: BabysitterCardData[] = [];

                if (showBabysitters) {
                  searchFilteredBabysitters = allBabysitters.filter(b => {
                    if (activeFilters.priceRange !== 'any') {
                      switch (activeFilters.priceRange) {
                        case '15-25': if (b.hourlyRate < 15 || b.hourlyRate > 25) return false; break;
                        case '25-35': if (b.hourlyRate < 25 || b.hourlyRate > 35) return false; break;
                        case '35-45': if (b.hourlyRate < 35 || b.hourlyRate > 45) return false; break;
                        case '45+': if (b.hourlyRate < 45) return false; break;
                      }
                    }
                    if (activeFilters.highlyRated && (b.averageRating || 0) < 4.5) return false;
                    if (activeFilters.experience !== 'any') {
                      switch (activeFilters.experience) {
                        case 'new': if (b.experienceYears > 2) return false; break;
                        case 'experienced': if (b.experienceYears < 3 || b.experienceYears > 7) return false; break;
                        case 'expert': if (b.experienceYears < 8) return false; break;
                      }
                    }
                    return true;
                  });
                }

                const displayCaregivers = showCaregiversOnly ? [] : filteredCaregivers;

                // Build merged listing array with type discriminator
                const mergedListings: Array<{ type: 'caregiver'; data: Caregiver } | { type: 'babysitter'; data: BabysitterCardData }> = [
                  ...displayCaregivers.map(c => ({ type: 'caregiver' as const, data: c })),
                  ...searchFilteredBabysitters.map(b => ({ type: 'babysitter' as const, data: b })),
                ];

                return mergedListings.length > 0 ? (
                <>
                  {/* Pagination calculations */}
                  {(() => {
                    const totalPages = Math.ceil(mergedListings.length / itemsPerPage);
                    const startIndex = (currentPage - 1) * itemsPerPage;
                    const endIndex = Math.min(startIndex + itemsPerPage, mergedListings.length);
                    const paginatedItems = mergedListings.slice(startIndex, endIndex);

                    return (
                      <>
                        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity duration-150 ${isMapFiltering ? 'opacity-50' : 'opacity-100'}`}>
                          {paginatedItems.map((item) => (
                            item.type === 'caregiver' ? (
                              <CaregiverCard
                                key={`c-${item.data.id}`}
                                caregiver={item.data as Caregiver}
                                onHover={setHoveredCaregiver}
                                isSelected={selectedCaregiver?.id === item.data.id}
                                showContactInfo={showCaregiverContactInfo}
                              />
                            ) : (
                              <BabysitterCard
                                key={`b-${item.data.id}`}
                                babysitter={item.data as BabysitterCardData}
                              />
                            )
                          ))}
                        </div>
                        {/* Loading indicator overlay */}
                        {isMapFiltering && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-lg flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                              <span className="text-sm text-gray-600 dark:text-gray-300">Updating...</span>
                            </div>
                          </div>
                        )}
                        
                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                          <div className="mt-8 flex items-center justify-between">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              Showing {startIndex + 1}-{endIndex} of {mergedListings.length} providers
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
              )
              })()}
            </div>

            {/* Map - Right Side (35% width on desktop, full width with fixed height on mobile) */}
            <div className="w-full h-[300px] lg:h-full lg:w-[35%]">
              <CaregiverMap
                caregivers={filteredCaregivers}
                selectedCaregiver={hoveredCaregiver || selectedCaregiver}
                onCaregiverSelect={handleCaregiverSelect}
                searchLocation={searchLocation || userLocation}
                onViewportChange={handleMapViewportChange}
                searchAsIMove={searchAsIMove}
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
              onViewportChange={handleMapViewportChange}
              searchAsIMove={searchAsIMove}
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