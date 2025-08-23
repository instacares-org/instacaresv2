// Geocoding service for precise address-to-coordinates conversion

interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
  accuracy?: string;
}

interface GeocodeOptions {
  streetAddress?: string;
  city: string;
  state: string;
  zipCode?: string;
  country?: string;
}

/**
 * Get precise coordinates for a street address using multiple geocoding services
 */
export async function geocodeAddress(options: GeocodeOptions): Promise<GeocodeResult | null> {
  const { streetAddress, city, state, zipCode, country = 'Canada' } = options;
  
  // Build the full address string
  const addressParts = [];
  if (streetAddress) addressParts.push(streetAddress);
  if (city) addressParts.push(city);
  if (state) addressParts.push(state);
  if (zipCode) addressParts.push(zipCode);
  if (country) addressParts.push(country);
  
  const fullAddress = addressParts.join(', ');
  console.log(`🗺️ Geocoding address: "${fullAddress}"`);

  // Try multiple geocoding services in order of preference for maximum precision
  
  // 1. Try Canadian geocoder first for Canadian addresses (often more precise)
  if (country.toLowerCase().includes('canada') || state.toLowerCase().includes('ontario')) {
    try {
      const result = await geocodeWithCanadianService(options);
      if (result) {
        console.log(`✅ Canadian geocoding successful: ${result.latitude}, ${result.longitude}`);
        return result;
      }
    } catch (error) {
      console.log(`❌ Canadian geocoding failed:`, error);
    }
  }

  // 2. Try OpenStreetMap Nominatim with enhanced precision strategies
  try {
    const result = await geocodeWithNominatim(fullAddress);
    if (result) {
      console.log(`✅ Nominatim geocoding successful: ${result.latitude}, ${result.longitude}`);
      return result;
    }
  } catch (error) {
    console.log(`❌ Nominatim geocoding failed:`, error);
  }

  // 3. Fallback to city-level coordinates
  const cityResult = getCityLevelCoordinates(city, state);
  if (cityResult) {
    console.log(`⚠️ Falling back to city-level coordinates: ${cityResult.latitude}, ${cityResult.longitude}`);
    return { ...cityResult, accuracy: 'city' };
  }

  console.log(`❌ All geocoding methods failed for: ${fullAddress}`);
  return null;
}

/**
 * Geocode using OpenStreetMap Nominatim with multiple precision strategies
 */
async function geocodeWithNominatim(address: string): Promise<GeocodeResult | null> {
  const encodedAddress = encodeURIComponent(address);
  
  // Strategy 1: Try exact address with building number first
  const strategies = [
    // Most precise: specific building search
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=3&countrycodes=ca&addressdetails=1&extratags=1&namedetails=1&dedupe=0&zoom=18`,
    // Backup: structured search
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=5&countrycodes=ca&addressdetails=1&zoom=17`,
    // Fallback: general search
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=ca&addressdetails=1`
  ];
  
  for (let i = 0; i < strategies.length; i++) {
    try {
      console.log(`🎯 Trying geocoding strategy ${i + 1}...`);
      const response = await fetch(strategies[i], {
        headers: {
          'User-Agent': 'InstaCares-Childcare-App/1.0'
        }
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        // Find the most precise result
        let bestResult = null;
        let bestScore = 0;
        
        for (const result of data) {
          let score = 0;
          let accuracy = 'unknown';
          
          // Score based on precision level
          if (result.addresstype === 'house') {
            score = 100;
            accuracy = 'rooftop';
          } else if (result.addresstype === 'building') {
            score = 95;
            accuracy = 'rooftop';
          } else if (result.class === 'place' && result.type === 'house') {
            score = 90;
            accuracy = 'rooftop';
          } else if (result.addresstype === 'way' || result.class === 'highway') {
            score = 70;
            accuracy = 'street';
          } else if (result.class === 'amenity' || result.class === 'shop') {
            score = 85; // Businesses often have precise coordinates
            accuracy = 'rooftop';
          } else {
            score = 50;
            accuracy = 'street';
          }
          
          // Bonus points for having a house number in the display name
          if (result.display_name && /\b\d+\b/.test(result.display_name.split(',')[0])) {
            score += 10;
          }
          
          // Bonus for having exact postal code match
          if (result.address && result.address.postcode) {
            score += 5;
          }
          
          if (score > bestScore) {
            bestScore = score;
            bestResult = { ...result, calculatedAccuracy: accuracy };
          }
        }
        
        if (bestResult) {
          console.log(`✅ Best result found with score ${bestScore}, type: ${bestResult.addresstype || bestResult.class}`);
          return {
            latitude: parseFloat(bestResult.lat),
            longitude: parseFloat(bestResult.lon),
            formatted_address: bestResult.display_name,
            accuracy: bestResult.calculatedAccuracy
          };
        }
      }
    } catch (error) {
      console.log(`⚠️ Strategy ${i + 1} failed:`, error.message);
      continue;
    }
  }
  
  return null;
}

/**
 * Geocode using Canadian Geocoder API for maximum precision
 */
async function geocodeWithCanadianService(options: GeocodeOptions): Promise<GeocodeResult | null> {
  const { streetAddress, city, state, zipCode } = options;
  
  if (!streetAddress || !city) return null;
  
  try {
    // Use the Canadian government's geocoding API
    const address = `${streetAddress}, ${city}, ${state}, ${zipCode || ''}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '');
    const encodedAddress = encodeURIComponent(address);
    
    // Canadian Geocoder API for high precision
    const url = `https://geocoder.ca/?locate=${encodedAddress}&geoit=JSON&json=1`;
    
    console.log(`🍁 Trying Canadian geocoder for: ${address}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'InstaCares-Childcare-App/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Canadian Geocoder API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.latt && data.longt && !data.error) {
      console.log(`✅ Canadian geocoder success: ${data.latt}, ${data.longt}`);
      return {
        latitude: parseFloat(data.latt),
        longitude: parseFloat(data.longt),
        formatted_address: data.standard?.stnumber ? 
          `${data.standard.stnumber} ${data.standard.staddress}, ${data.standard.city}, ${data.standard.prov}` : 
          address,
        accuracy: 'rooftop' // Canadian geocoder often provides building-level precision
      };
    }
  } catch (error) {
    console.log(`⚠️ Canadian geocoder failed:`, error.message);
  }
  
  return null;
}

/**
 * Fallback to city-level coordinates for major Canadian cities
 */
function getCityLevelCoordinates(city: string, state: string): GeocodeResult | null {
  const cityMapping: Record<string, {lat: number, lng: number}> = {
    // Ontario
    'toronto': { lat: 43.6532, lng: -79.3832 },
    'ottawa': { lat: 45.4215, lng: -75.6972 },
    'hamilton': { lat: 43.2557, lng: -79.8711 },
    'kitchener': { lat: 43.4501, lng: -80.4829 },
    'london': { lat: 42.9849, lng: -81.2453 },
    'windsor': { lat: 42.3149, lng: -83.0364 },
    'mississauga': { lat: 43.5890, lng: -79.6441 },
    'brampton': { lat: 43.7315, lng: -79.7624 },
    'markham': { lat: 43.8561, lng: -79.3370 },
    'etobicoke': { lat: 43.6205, lng: -79.5132 },
    'scarborough': { lat: 43.7735, lng: -79.2620 },
    'north york': { lat: 43.7615, lng: -79.4111 },
    'york': { lat: 43.6890, lng: -79.4870 },
    'east york': { lat: 43.6890, lng: -79.3467 },
    
    // Quebec
    'montreal': { lat: 45.5017, lng: -73.5673 },
    'quebec city': { lat: 46.8139, lng: -71.2080 },
    'laval': { lat: 45.6066, lng: -73.7124 },
    'gatineau': { lat: 45.4765, lng: -75.7013 },
    
    // British Columbia
    'vancouver': { lat: 49.2827, lng: -123.1207 },
    'burnaby': { lat: 49.2488, lng: -122.9805 },
    'richmond': { lat: 49.1666, lng: -123.1336 },
    'surrey': { lat: 49.1913, lng: -122.8490 },
    'victoria': { lat: 48.4284, lng: -123.3656 },
    
    // Alberta
    'calgary': { lat: 51.0447, lng: -114.0719 },
    'edmonton': { lat: 53.5461, lng: -113.4938 },
    
    // Other provinces
    'winnipeg': { lat: 49.8951, lng: -97.1384 },
    'saskatoon': { lat: 52.1579, lng: -106.6702 },
    'regina': { lat: 50.4452, lng: -104.6189 },
    'halifax': { lat: 44.6488, lng: -63.5752 },
    'moncton': { lat: 46.0878, lng: -64.7782 },
    'fredericton': { lat: 45.9636, lng: -66.6431 },
    'st. john\'s': { lat: 47.5615, lng: -52.7126 },
    'charlottetown': { lat: 46.2382, lng: -63.1311 },
    'yellowknife': { lat: 62.4540, lng: -114.3718 },
    'whitehorse': { lat: 60.7212, lng: -135.0568 },
    'iqaluit': { lat: 63.7467, lng: -68.5170 }
  };
  
  const normalizedCity = city.toLowerCase().trim();
  const coords = cityMapping[normalizedCity];
  
  if (coords) {
    return {
      latitude: coords.lat,
      longitude: coords.lng,
      accuracy: 'city'
    };
  }
  
  return null;
}

/**
 * Validate coordinates to ensure they're reasonable for Canada
 */
export function validateCanadianCoordinates(lat: number, lng: number): boolean {
  // Canada's approximate bounding box
  const CANADA_BOUNDS = {
    north: 83.0,    // Northern tip
    south: 41.0,    // Southern border (Pelee Island)
    east: -52.0,    // Eastern tip (Newfoundland)
    west: -141.0    // Western border (Yukon)
  };
  
  return lat >= CANADA_BOUNDS.south && 
         lat <= CANADA_BOUNDS.north && 
         lng >= CANADA_BOUNDS.west && 
         lng <= CANADA_BOUNDS.east;
}