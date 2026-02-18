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

export default function AddressAutocompleteSimple({
  onAddressSelect,
  defaultValue = '',
  placeholder = 'Start typing your address...',
  className = '',
  label = 'Address',
  required = false,
  disabled = false
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [mapboxLoaded, setMapboxLoaded] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const [AddressAutofill, setAddressAutofill] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get Mapbox token from environment
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  useEffect(() => {
    console.log('🔑 Simple AddressAutocomplete Debug:', {
      hasToken: !!MAPBOX_TOKEN,
      tokenLength: MAPBOX_TOKEN.length,
      tokenStart: MAPBOX_TOKEN.substring(0, 15),
      tokenEnd: MAPBOX_TOKEN.substring(MAPBOX_TOKEN.length - 10)
    });

    // Check if we have a valid token
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.length < 50) {
      console.warn('⚠️ Invalid or missing Mapbox token, using fallback');
      setShowFallback(true);
      return;
    }

    // Load Mapbox components with token pre-configured
    const loadMapbox = async () => {
      try {
        console.log('📦 Loading Mapbox Search JS React...');
        
        // Import the module
        const mapboxModule = await import('@mapbox/search-js-react');
        
        console.log('🔧 Configuring Mapbox with token...');
        
        // Set the access token before using any components
        mapboxModule.config.accessToken = MAPBOX_TOKEN;
        
        console.log('✅ Mapbox config set:', {
          tokenSet: !!mapboxModule.config.accessToken,
          configTokenLength: mapboxModule.config.accessToken?.length || 0
        });
        
        // Store the component
        setAddressAutofill(() => mapboxModule.AddressAutofill);
        setMapboxLoaded(true);
        
        console.log('✅ Mapbox components ready!');
      } catch (error) {
        console.error('❌ Failed to load Mapbox:', error);
        setShowFallback(true);
      }
    };

    loadMapbox();
  }, [MAPBOX_TOKEN]);

  // Show fallback if no token or failed to load
  if (showFallback || !mapboxLoaded || !AddressAutofill) {
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
            // For fallback, just pass the raw address
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
          {!mapboxLoaded && !showFallback ? '🔄 Loading address autocomplete...' : 'ℹ️ Manual address entry (Mapbox not available)'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
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
        onRetrieve={(features: any) => {
          console.log('📍 Mapbox onRetrieve called:', features);
          
          if (features && features.features && features.features.length > 0) {
            const feature = features.features[0];
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

            console.log('📍 Address parsed:', addressData);
            
            // Update input
            const fullAddress = `${addressData.streetAddress}, ${addressData.city}, ${addressData.state} ${addressData.zipCode}`.trim().replace(/,\s*,/g, ',');
            setInputValue(fullAddress);
            
            // Call parent handler
            onAddressSelect(addressData);
          }
        }}
      >
        <input
          ref={inputRef}
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
      
      <p className="text-xs text-gray-500 dark:text-gray-400">
        📍 Start typing to see address suggestions
      </p>
    </div>
  );
}