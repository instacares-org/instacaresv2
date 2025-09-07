import { NextRequest, NextResponse } from 'next/server';

interface NominatimRequest {
  query: string;
  country?: string;
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: NominatimRequest = await request.json();
    const { query, country = 'CA' } = body;

    if (!query || query.length < 3) {
      return NextResponse.json(
        { error: 'Query must be at least 3 characters long' },
        { status: 400 }
      );
    }

    console.log('🌍 Geocoding request:', { query, country });

    // Build Nominatim API request
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '5',
      countrycodes: country.toLowerCase(),
      dedupe: '1',
      bounded: '1',
      viewbox: '-141.003,41.676,-52.636,83.162' // Canada bounds
    });

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'InstaCares-AddressSearch/1.0 (contact@instacares.com)', // Required by Nominatim
        'Accept': 'application/json',
        'Accept-Language': 'en'
      },
      // Add timeout and retry logic
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      console.error('❌ Nominatim API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Geocoding service error: ${response.status}` },
        { status: response.status }
      );
    }

    const results: NominatimResult[] = await response.json();
    console.log('📍 Nominatim raw results:', results.length, 'results found');

    // Filter and enhance results
    const filteredResults = results
      .filter(result => {
        // Only return results that look like actual addresses
        return result.address && (
          result.address.house_number ||
          result.address.road ||
          result.display_name.toLowerCase().includes(query.toLowerCase())
        );
      })
      .map(result => ({
        ...result,
        // Ensure we have clean address components
        address: {
          ...result.address,
          city: result.address?.city || result.address?.town || result.address?.village,
          // Standardize province names
          state: result.address?.state ? standardizeProvince(result.address.state) : undefined
        }
      }))
      .slice(0, 5); // Limit to 5 results

    console.log('📋 Filtered results:', filteredResults.length, 'results returned');

    return NextResponse.json(filteredResults, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600', // Cache for 5 minutes
      },
    });

  } catch (error) {
    console.error('❌ Geocoding API error:', error);
    
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout - please try again' },
        { status: 408 }
      );
    }

    return NextResponse.json(
      { error: 'Internal geocoding error' },
      { status: 500 }
    );
  }
}

// Helper function to standardize Canadian province names
function standardizeProvince(province: string): string {
  const provinceMap: { [key: string]: string } = {
    'Ontario': 'Ontario',
    'Quebec': 'Quebec',
    'British Columbia': 'British Columbia',
    'Alberta': 'Alberta',
    'Manitoba': 'Manitoba',
    'Saskatchewan': 'Saskatchewan',
    'Nova Scotia': 'Nova Scotia',
    'New Brunswick': 'New Brunswick',
    'Newfoundland and Labrador': 'Newfoundland and Labrador',
    'Prince Edward Island': 'Prince Edward Island',
    'Northwest Territories': 'Northwest Territories',
    'Nunavut': 'Nunavut',
    'Yukon': 'Yukon',
    // Handle common variations
    'ON': 'Ontario',
    'QC': 'Quebec',
    'BC': 'British Columbia',
    'AB': 'Alberta',
    'MB': 'Manitoba',
    'SK': 'Saskatchewan',
    'NS': 'Nova Scotia',
    'NB': 'New Brunswick',
    'NL': 'Newfoundland and Labrador',
    'PE': 'Prince Edward Island',
    'NT': 'Northwest Territories',
    'NU': 'Nunavut',
    'YT': 'Yukon'
  };

  return provinceMap[province] || province;
}

export async function GET() {
  return NextResponse.json(
    { error: 'Use POST method with query parameter' },
    { status: 405 }
  );
}