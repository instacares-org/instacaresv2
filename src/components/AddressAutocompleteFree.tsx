"use client";

import { useState, useEffect, useRef } from 'react';

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
  licence: string;
  osm_type: string;
  osm_id: number;
  boundingbox: string[];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  address: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

export default function AddressAutocompleteFree({
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
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const searchAddresses = async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🔍 Searching for:', query);
      
      // Use our proxy API to avoid CORS issues
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
      console.log('📍 Nominatim results:', results);

      // Filter for better results (addresses with house numbers preferred)
      const filteredResults = results
        .filter(result => {
          // Prefer results with actual addresses
          return result.address && (
            result.address.house_number || 
            result.address.road || 
            result.class === 'place'
          );
        })
        .slice(0, 5);

      setSuggestions(filteredResults);
      setShowSuggestions(filteredResults.length > 0);
    } catch (error) {
      console.error('❌ Address search error:', error);
      setError('Address search failed. Please try typing manually.');
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setError(null);

    // Debounce the search to avoid too many API calls
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchAddresses(value);
    }, 300); // Wait 300ms after user stops typing
  };

  const selectSuggestion = (suggestion: NominatimResult) => {
    console.log('📍 Selected suggestion:', suggestion);

    // Parse the address components
    const addr = suggestion.address || {};
    
    // Build street address
    let streetAddress = '';
    if (addr.house_number && addr.road) {
      streetAddress = `${addr.house_number} ${addr.road}`;
    } else if (addr.road) {
      streetAddress = addr.road;
    } else {
      // Fallback to the place name
      streetAddress = suggestion.display_name.split(',')[0].trim();
    }

    // Determine city - prefer city, then suburb, then neighbourhood
    let city = addr.city || addr.suburb || addr.neighbourhood || '';
    
    // Handle Ontario/Toronto area specifics
    let state = 'Ontario';
    if (addr.state) {
      // Map full province names to abbreviations
      const provinceMap: { [key: string]: string } = {
        'Ontario': 'ON',
        'Quebec': 'QC',
        'British Columbia': 'BC',
        'Alberta': 'AB',
        'Manitoba': 'MB',
        'Saskatchewan': 'SK',
        'Nova Scotia': 'NS',
        'New Brunswick': 'NB',
        'Newfoundland and Labrador': 'NL',
        'Prince Edward Island': 'PE',
        'Northwest Territories': 'NT',
        'Nunavut': 'NU',
        'Yukon': 'YT'
      };
      state = provinceMap[addr.state] || addr.state;
    }

    const addressData: AddressData = {
      streetAddress: streetAddress,
      apartment: '', // Apartment/unit to be filled manually
      city: city,
      state: state,
      zipCode: addr.postcode || '',
      country: 'Canada',
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon)
    };

    console.log('📍 Parsed address data:', addressData);

    // Update input with formatted address
    const fullAddress = `${streetAddress}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}${addr.postcode ? ` ${addr.postcode}` : ''}`;
    setInputValue(fullAddress);

    // Hide suggestions
    setShowSuggestions(false);
    setSuggestions([]);

    // Call parent handler
    onAddressSelect(addressData);
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

      {/* Error message */}
      {error && (
        <div className="text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.place_id}
              type="button"
              onClick={() => selectSuggestion(suggestion)}
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
      
      <p className="text-xs text-gray-500 dark:text-gray-400">
        🌍 Free address autocomplete powered by OpenStreetMap
      </p>
    </div>
  );
}