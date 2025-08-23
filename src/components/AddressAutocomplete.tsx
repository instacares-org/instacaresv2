"use client";

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

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

// Component that uses Mapbox Search JS (client-side only)
function MapboxAddressAutocomplete({
  onAddressSelect,
  defaultValue = '',
  placeholder = 'Start typing your address...',
  className = '',
  label = 'Address',
  required = false,
  disabled = false
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [showFallback, setShowFallback] = useState(false);
  const [AddressAutofill, setAddressAutofill] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get Mapbox token from environment
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  useEffect(() => {
    console.log('🔑 Mapbox Token Debug:', {
      hasToken: !!MAPBOX_TOKEN,
      tokenLength: MAPBOX_TOKEN.length,
      tokenStart: MAPBOX_TOKEN.substring(0, 15),
      tokenEnd: MAPBOX_TOKEN.substring(MAPBOX_TOKEN.length - 10),
      isExample: MAPBOX_TOKEN.includes('example'),
      envVar: process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.substring(0, 15) + '...'
    });

    // Only load Mapbox components if we have a valid token
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes('example') || MAPBOX_TOKEN.length < 50) {
      console.warn('⚠️ Mapbox token not configured or invalid. Using fallback address input.');
      setShowFallback(true);
    } else {
      // Dynamically import Mapbox components (client-side only)
      import('@mapbox/search-js-react').then((mapboxModule) => {
        console.log('🔧 Setting Mapbox token:', MAPBOX_TOKEN.substring(0, 15) + '...');
        
        // Set the token immediately on the config object
        try {
          mapboxModule.config.accessToken = MAPBOX_TOKEN;
          console.log('🔑 Token set on config:', !!mapboxModule.config.accessToken);
          
          // Verify the token was set
          if (!mapboxModule.config.accessToken || mapboxModule.config.accessToken !== MAPBOX_TOKEN) {
            throw new Error('Token not set properly on config');
          }
          
          setAddressAutofill(() => mapboxModule.AddressAutofill);
          setConfig(mapboxModule.config);
          console.log('✅ Mapbox components loaded successfully with token length:', MAPBOX_TOKEN.length);
        } catch (configError) {
          console.error('❌ Failed to configure Mapbox token:', configError);
          setShowFallback(true);
        }
      }).catch((error) => {
        console.error('❌ Failed to load Mapbox components:', error);
        setShowFallback(true);
      });
    }
  }, [MAPBOX_TOKEN]);

  // Fallback to regular input if Mapbox is not configured or failed to load
  if (showFallback || !AddressAutofill) {
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
          {!AddressAutofill && !showFallback ? '🔄 Loading address autocomplete...' : 'ℹ️ Address autocomplete requires Mapbox configuration'}
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
          country: 'CA', // Canada only
          language: 'en',
          limit: 6,
          proximity: 'ip', // Use user's IP location for better suggestions
        }}
        onRetrieve={(features: any) => {
          if (features && features.features && features.features.length > 0) {
            const feature = features.features[0];
            const props = feature.properties || {};
            
            // Extract address components
            const addressData: AddressData = {
              streetAddress: props.address_line1 || props.name || '',
              city: props.address_level2 || props.place || '',
              state: props.address_level1 || props.region || 'Ontario',
              zipCode: props.postcode || '',
              country: props.country || 'Canada',
              latitude: feature.geometry?.coordinates?.[1],
              longitude: feature.geometry?.coordinates?.[0]
            };

            // Handle Toronto neighborhoods specially
            if (addressData.city === 'Toronto' && props.address_level3) {
              // Use neighborhood as city for Toronto areas
              const neighborhoods = ['Etobicoke', 'Scarborough', 'North York', 'York', 'East York'];
              if (neighborhoods.some(n => props.address_level3.includes(n))) {
                addressData.city = props.address_level3;
              }
            }

            console.log('📍 Address selected:', addressData);
            
            // Update input value
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

// Dynamically imported component that only renders on client side
const DynamicAddressAutocomplete = dynamic(() => Promise.resolve(MapboxAddressAutocomplete), {
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