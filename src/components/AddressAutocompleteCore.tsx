"use client";

import { useState, useEffect, useRef } from 'react';

interface AddressData {
  streetAddress: string;
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

export default function AddressAutocompleteCore({
  onAddressSelect,
  defaultValue = '',
  placeholder = 'Start typing your address...',
  className = '',
  label = 'Address',
  required = false,
  disabled = false
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchCore, setSearchCore] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get Mapbox token from environment
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  useEffect(() => {
    console.log('🔑 Core AddressAutocomplete Debug:', {
      hasToken: !!MAPBOX_TOKEN,
      tokenLength: MAPBOX_TOKEN.length,
      tokenStart: MAPBOX_TOKEN.substring(0, 15),
      envCheck: !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    });

    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.length < 50) {
      console.warn('⚠️ Invalid Mapbox token');
      return;
    }

    // Load the core search library
    const initializeSearch = async () => {
      try {
        console.log('📦 Loading @mapbox/search-js-web...');
        
        const searchModule = await import('@mapbox/search-js-web');
        console.log('📦 Search module loaded:', searchModule);
        console.log('📦 Available exports:', Object.keys(searchModule));

        // Try different available constructors
        let core;
        if (searchModule.SearchBoxCore) {
          core = new searchModule.SearchBoxCore({
            accessToken: MAPBOX_TOKEN,
            language: 'en',
            country: 'CA',
            limit: 6,
            proximity: 'ip'
          });
        } else if (searchModule.AddressAutofillCore) {
          core = new searchModule.AddressAutofillCore({
            accessToken: MAPBOX_TOKEN,
            language: 'en',
            country: 'CA',
            limit: 6,
            proximity: 'ip'
          });
        } else if (searchModule.SearchApi) {
          core = new searchModule.SearchApi({
            accessToken: MAPBOX_TOKEN
          });
        } else {
          throw new Error('No suitable search constructor found');
        }

        console.log('✅ SearchBoxCore created with token');
        setSearchCore(core);
      } catch (error) {
        console.error('❌ Failed to load search library:', error);
      }
    };

    initializeSearch();
  }, [MAPBOX_TOKEN]);

  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (!searchCore || value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 Searching for:', value);
      
      // Use the search core to get suggestions
      const response = await searchCore.suggest(value);
      console.log('📍 Search response:', response);

      if (response && response.suggestions) {
        setSuggestions(response.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('❌ Search error:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  const selectSuggestion = async (suggestion: any) => {
    try {
      console.log('📍 Selecting suggestion:', suggestion);
      
      // Retrieve full address details
      const response = await searchCore.retrieve(suggestion);
      console.log('📍 Retrieved address:', response);

      if (response && response.features && response.features.length > 0) {
        const feature = response.features[0];
        const props = feature.properties || {};
        
        const addressData: AddressData = {
          streetAddress: props.address_line1 || props.name || '',
          city: props.address_level2 || props.place || '',
          state: props.address_level1 || props.region || 'Ontario',
          zipCode: props.postcode || '',
          country: props.country || 'Canada',
          latitude: feature.geometry?.coordinates?.[1],
          longitude: feature.geometry?.coordinates?.[0]
        };

        // Handle Toronto neighborhoods
        if (addressData.city === 'Toronto' && props.address_level3) {
          const neighborhoods = ['Etobicoke', 'Scarborough', 'North York', 'York', 'East York'];
          if (neighborhoods.some(n => props.address_level3.includes(n))) {
            addressData.city = props.address_level3;
          }
        }

        console.log('📍 Final address data:', addressData);
        
        // Update input
        const fullAddress = `${addressData.streetAddress}, ${addressData.city}, ${addressData.state} ${addressData.zipCode}`.trim().replace(/,\s*,/g, ',');
        setInputValue(fullAddress);
        
        // Hide suggestions
        setShowSuggestions(false);
        
        // Call parent handler
        onAddressSelect(addressData);
      }
    } catch (error) {
      console.error('❌ Retrieve error:', error);
    }
  };

  if (!searchCore) {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            onAddressSelect({
              streetAddress: e.target.value,
              city: '',
              state: '',
              zipCode: '',
              country: 'Canada'
            });
          }}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 dark:bg-gray-700 dark:text-white ${className}`}
        />
        <p className="text-xs text-amber-600 dark:text-amber-400">
          🔄 Loading address search...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      <div className="relative">
        <input
          ref={inputRef}
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

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => selectSuggestion(suggestion)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
            >
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {suggestion.name || suggestion.mapbox_id}
              </div>
              {suggestion.context && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {suggestion.context}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      
      <p className="text-xs text-gray-500 dark:text-gray-400">
        📍 Start typing to see address suggestions
      </p>
    </div>
  );
}