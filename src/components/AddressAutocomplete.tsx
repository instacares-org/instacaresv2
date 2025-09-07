"use client";

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

interface AddressData {
  streetAddress: string;
  apartment?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

interface AddressAutocompleteProps {
  onAddressSelect: (address: AddressData) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
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

// Component that uses Mapbox as primary and OpenStreetMap as fallback
function UnifiedAddressAutocomplete({
  onAddressSelect,
  defaultValue = '',
  placeholder = 'Start typing your address...',
  className = '',
  label = 'Address',
  required = false,
  disabled = false
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMapbox, setUseMapbox] = useState(true);
  const [AddressAutofill, setAddressAutofill] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Get Mapbox token from environment
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  useEffect(() => {
    console.log('🔑 Mapbox Token Debug:', {
      hasToken: !!MAPBOX_TOKEN,
      tokenLength: MAPBOX_TOKEN.length,
      tokenStart: MAPBOX_TOKEN.substring(0, 15),
      isValidToken: MAPBOX_TOKEN.startsWith('pk.'),
      isExample: MAPBOX_TOKEN.includes('example') || MAPBOX_TOKEN.includes('your_mapbox')
    });

    // Only load Mapbox components if we have a valid token
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('example') || MAPBOX_TOKEN.includes('your_mapbox') || MAPBOX_TOKEN.length < 50 || !MAPBOX_TOKEN.startsWith('pk.')) {
      console.warn('⚠️ Mapbox token not configured or invalid. Using OpenStreetMap fallback.');
      setUseMapbox(false);
    } else {
      // Dynamically import Mapbox components (client-side only)
      import('@mapbox/search-js-react').then((mapboxModule) => {
        console.log('🔧 Loading Mapbox components with token:', MAPBOX_TOKEN.substring(0, 15) + '...');
        
        try {
          // Set the global access token
          if (mapboxModule.config) {
            mapboxModule.config.accessToken = MAPBOX_TOKEN;
          }
          
          setAddressAutofill(() => mapboxModule.AddressAutofill);
          setUseMapbox(true);
          console.log('✅ Mapbox components loaded successfully');
        } catch (configError) {
          console.error('❌ Failed to configure Mapbox:', configError);
          setUseMapbox(false);
        }
      }).catch((error) => {
        console.error('❌ Failed to load Mapbox components:', error);
        setUseMapbox(false);
      });
    }
  }, [MAPBOX_TOKEN]);

  // OpenStreetMap search function
  const searchWithOSM = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🌍 Searching with OpenStreetMap for:', query);
      
      // Create proxy endpoint to avoid CORS issues
      const response = await fetch('/api/geocode/nominatim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: query,
          country: 'CA'
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const results: NominatimResult[] = await response.json();
      console.log('📍 OSM results:', results);

      const filteredResults = results
        .filter(result => {
          return result.address && (
            result.address.house_number || 
            result.address.road ||
            result.display_name.includes('Canada')
          );
        })
        .slice(0, 5);

      setSuggestions(filteredResults);
      setShowSuggestions(filteredResults.length > 0);
    } catch (error) {
      console.error('❌ OSM address search error:', error);
      setError('Address search failed. Please try typing manually.');
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change for OSM fallback
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setError(null);

    if (!useMapbox || !AddressAutofill) {
      // Debounce the search to avoid too many API calls
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        searchWithOSM(value);
      }, 300);
    }
  };

  // Handle OSM suggestion selection
  const selectOSMSuggestion = (suggestion: NominatimResult) => {
    console.log('📍 Selected OSM suggestion:', suggestion);

    const addr = suggestion.address || {};
    
    let streetAddress = '';
    if (addr.house_number && addr.road) {
      streetAddress = `${addr.house_number} ${addr.road}`;
    } else if (addr.road) {
      streetAddress = addr.road;
    } else {
      streetAddress = suggestion.display_name.split(',')[0].trim();
    }

    let city = addr.city || addr.town || addr.village || '';
    
    let state = 'Ontario';
    if (addr.state) {
      const provinceMap: { [key: string]: string } = {
        'Ontario': 'ON', 'Quebec': 'QC', 'British Columbia': 'BC',
        'Alberta': 'AB', 'Manitoba': 'MB', 'Saskatchewan': 'SK',
        'Nova Scotia': 'NS', 'New Brunswick': 'NB',
        'Newfoundland and Labrador': 'NL', 'Prince Edward Island': 'PE',
        'Northwest Territories': 'NT', 'Nunavut': 'NU', 'Yukon': 'YT'
      };
      state = provinceMap[addr.state] || addr.state;
    }

    const addressData: AddressData = {
      streetAddress: streetAddress,
      apartment: '',
      city: city,
      state: state,
      zipCode: addr.postcode || '',
      country: 'Canada',
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon)
    };

    const fullAddress = `${streetAddress}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}${addr.postcode ? ` ${addr.postcode}` : ''}`;
    setInputValue(fullAddress);
    setShowSuggestions(false);
    setSuggestions([]);
    onAddressSelect(addressData);
  };

  // Handle Mapbox address selection
  const handleMapboxRetrieve = (result: any) => {
    console.log('📍 Mapbox result:', result);
    
    if (result && result.features && result.features.length > 0) {
      const feature = result.features[0];
      const props = feature.properties || {};
      
      const addressData: AddressData = {
        streetAddress: props.address_line1 || props.name || '',
        apartment: '',
        city: props.address_level2 || props.place || '',
        state: props.address_level1 || props.region || 'Ontario',
        zipCode: props.postcode || '',
        country: props.country || 'Canada',
        latitude: feature.geometry?.coordinates?.[1],
        longitude: feature.geometry?.coordinates?.[0]
      };

      if (addressData.city === 'Toronto' && props.address_level3) {
        const neighborhoods = ['Etobicoke', 'Scarborough', 'North York', 'York', 'East York'];
        if (neighborhoods.some(n => props.address_level3.includes(n))) {
          addressData.city = props.address_level3;
        }
      }

      console.log('📍 Parsed Mapbox address:', addressData);
      
      const fullAddress = `${addressData.streetAddress}, ${addressData.city}, ${addressData.state} ${addressData.zipCode}`.trim().replace(/,\s*,/g, ',');
      setInputValue(fullAddress);
      onAddressSelect(addressData);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Use Mapbox if available, otherwise use OSM fallback
  if (useMapbox && AddressAutofill) {
    return (
      <div className="space-y-2" ref={inputRef}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        
        <AddressAutofill
          accessToken={MAPBOX_TOKEN}
          options={{
            country: 'CA',
            language: 'en',
            limit: 6,
            proximity: 'ip',
          }}
          onRetrieve={handleMapboxRetrieve}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            autoComplete="address-line1"
            className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 dark:bg-gray-700 dark:text-white ${className}`}
          />
        </AddressAutofill>
        
        <p className="text-xs text-green-600 dark:text-green-400">
          🗺️ Powered by Mapbox - Start typing to see suggestions
        </p>
      </div>
    );
  }

  // Fallback to OpenStreetMap
  return (
    <div className="space-y-2 relative" ref={inputRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="address-line1"
          className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 dark:bg-gray-700 dark:text-white ${className}`}
        />
        
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-rose-600"></div>
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => selectOSMSuggestion(suggestion)}
              className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none border-b border-gray-100 dark:border-gray-700 last:border-b-0"
            >
              <div className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                {suggestion.address?.house_number && suggestion.address?.road 
                  ? `${suggestion.address.house_number} ${suggestion.address.road}`
                  : suggestion.display_name.split(',')[0]
                }
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {suggestion.display_name}
              </div>
            </button>
          ))}
        </div>
      )}
      
      <p className="text-xs text-blue-600 dark:text-blue-400">
        🌍 Fallback: OpenStreetMap - Start typing to see suggestions
      </p>
    </div>
  );
}

// Dynamically imported component that only renders on client side
const DynamicAddressAutocomplete = dynamic(() => Promise.resolve(UnifiedAddressAutocomplete), {
  ssr: false,
  loading: () => (
    <div className="space-y-2">
      <div className="animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-16 mb-2"></div>
        <div className="h-10 bg-gray-200 border border-gray-300 rounded-lg"></div>
        <div className="h-3 bg-gray-200 rounded w-48 mt-1"></div>
      </div>
    </div>
  )
});

export default function AddressAutocomplete(props: AddressAutocompleteProps) {
  return <DynamicAddressAutocomplete {...props} />;
}