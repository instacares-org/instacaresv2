/**
 * Mapbox Geocoding Utility
 * Automatically converts location names to coordinates using Mapbox Geocoding API
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Cache for geocoded locations to avoid redundant API calls
const geocodeCache = new Map<string, { lat: number; lng: number; timestamp: number }>();
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
}

/**
 * Geocode a location string to coordinates using Mapbox Geocoding API
 * Automatically restricts to Canada
 * 
 * @param location - Location string (e.g., "Mississauga, ON", "Toronto", "Montreal, QC")
 * @returns Promise with coordinates or null if not found
 */
export async function geocodeLocation(location: string): Promise<GeocodeResult | null> {
  if (!location || !MAPBOX_TOKEN) {
    console.warn('🚫 Geocoding skipped: Missing location or Mapbox token');
    return null;
  }

  const normalizedLocation = location.trim();
  
  // Check cache first
  const cached = geocodeCache.get(normalizedLocation);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    console.log(`✅ Geocode cache hit for "${normalizedLocation}"`, cached);
    return { lat: cached.lat, lng: cached.lng };
  }

  try {
    console.log(`🌍 Geocoding "${normalizedLocation}" via Mapbox API...`);
    
    // Mapbox Geocoding API endpoint
    // country=ca restricts results to Canada only
    // types=address,place,postcode prioritizes street addresses, then cities, then postal codes
    const encodedLocation = encodeURIComponent(normalizedLocation);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?country=ca&types=address,place,postcode&limit=1&access_token=${MAPBOX_TOKEN}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`❌ Mapbox Geocoding API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      console.warn(`⚠️ No results found for "${normalizedLocation}"`);
      return null;
    }

    // Extract coordinates from first result
    const feature = data.features[0];
    const [lng, lat] = feature.center;
    const formattedAddress = feature.place_name;
    
    console.log(`✅ Geocoded "${normalizedLocation}" → ${formattedAddress}`, { lat, lng });
    
    // Cache the result
    geocodeCache.set(normalizedLocation, { lat, lng, timestamp: Date.now() });
    
    return { lat, lng, formattedAddress };
    
  } catch (error) {
    console.error(`❌ Geocoding error for "${normalizedLocation}":`, error);
    return null;
  }
}

/**
 * Batch geocode multiple locations
 * @param locations - Array of location strings
 * @returns Promise with array of results (null for failed geocodes)
 */
export async function geocodeBatch(locations: string[]): Promise<(GeocodeResult | null)[]> {
  console.log(`🌍 Batch geocoding ${locations.length} locations...`);
  
  // Process in parallel with small delay to respect rate limits
  const results = await Promise.all(
    locations.map((location, index) => 
      new Promise<GeocodeResult | null>((resolve) => {
        // Stagger requests by 100ms to avoid rate limiting
        setTimeout(async () => {
          const result = await geocodeLocation(location);
          resolve(result);
        }, index * 100);
      })
    )
  );
  
  const successCount = results.filter(r => r !== null).length;
  console.log(`✅ Batch geocoding complete: ${successCount}/${locations.length} successful`);
  
  return results;
}

/**
 * Clear the geocoding cache
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
  console.log('🧹 Geocode cache cleared');
}

/**
 * Geocode a full address (street, city, province, postal code)
 * @param address - Full address object or string
 * @returns Promise with coordinates or null
 */
/**
 * Geocode a full address with maximum precision
 * Attempts to get rooftop-level accuracy for street addresses
 * Falls back to city/postal code if street address not found
 * 
 * @param address - Full address string or address components
 * @returns GeocodeResult with lat/lng or null
 */
export async function geocodeAddress(address: string | {
  street?: string;
  apartment?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
}): Promise<GeocodeResult | null> {
  let addressString: string;
  
  if (typeof address === 'string') {
    addressString = address;
  } else {
    // Build address string from components
    const parts = [
      address.street,
      address.apartment,
      address.city,
      address.province,
      address.postalCode,
      address.country || 'Canada'
    ].filter(Boolean);
    addressString = parts.join(', ');
  }
  
  return geocodeLocation(addressString);
}

/**
 * Validate that coordinates are within Canadian bounds
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Boolean indicating if coordinates are in Canada
 */
export function validateCanadianCoordinates(lat: number, lng: number): boolean {
  // Rough Canadian geographic bounds
  // Latitude: ~41.7° N (southern Ontario) to ~83.1° N (northern territories)
  // Longitude: ~-141° W (Yukon) to ~-52.6° W (Newfoundland)
  
  const inLatRange = lat >= 41.5 && lat <= 84.0;
  const inLngRange = lng >= -141.5 && lng <= -52.0;
  
  return inLatRange && inLngRange;
}
