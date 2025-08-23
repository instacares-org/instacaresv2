'use client';

import React, { useState, useEffect } from 'react';
import { AddressAutofill } from '@mapbox/search-js-react';

export interface AddressData {
  streetAddress: string;
  apartment?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

interface MapboxAddressAutocompleteProps {
  label?: string;
  placeholder?: string;
  onAddressSelect: (address: AddressData) => void;
  defaultValue?: string;
  className?: string;
}

export default function MapboxAddressAutocomplete({
  label = "Address",
  placeholder = "Start typing your address...",
  onAddressSelect,
  defaultValue = "",
  className = ""
}: MapboxAddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [mapboxToken, setMapboxToken] = useState<string>('');

  useEffect(() => {
    // Get Mapbox token from environment
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (token) {
      setMapboxToken(token);
    } else {
      console.error('Mapbox token not found in environment variables');
    }
  }, []);

  const handleRetrieve = (result: any) => {
    console.log('Mapbox address result:', result);
    
    if (result && result.features && result.features.length > 0) {
      const feature = result.features[0];
      const { properties, geometry } = feature;
      
      console.log('Mapbox properties:', {
        address_number: properties.address_number,
        address_line1: properties.address_line1,
        address_line2: properties.address_line2,
        place_name: properties.place_name,
        place: properties.place,
        locality: properties.locality,
        region: properties.region,
        postcode: properties.postcode
      });
      
      // Extract address components
      // Use address_line1 if available (it usually includes the full street address)
      // Otherwise, combine address_number with street name, or fall back to place_name
      const streetAddress = properties.address_line1 || 
        [properties.address_number, properties.address_line2].filter(Boolean).join(' ') ||
        properties.place_name || '';
      
      const city = properties.place || properties.locality || '';
      const state = properties.region || properties.state || '';
      const zipCode = properties.postcode || '';
      const country = properties.country || 'Canada';
      
      // Extract coordinates
      const coordinates = geometry?.coordinates;
      const longitude = coordinates?.[0];
      const latitude = coordinates?.[1];
      
      const addressData: AddressData = {
        streetAddress: streetAddress.trim(),
        apartment: '', // Apartment/unit to be filled manually
        city: city.trim(),
        state: state.trim(),
        zipCode: zipCode.trim(),
        country: country.trim(),
        latitude,
        longitude
      };
      
      console.log('Parsed address data:', addressData);
      onAddressSelect(addressData);
    }
  };

  if (!mapboxToken) {
    return (
      <div className={`mb-4 ${className}`}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
        <input
          type="text"
          placeholder="Mapbox token not configured"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500"
          disabled
        />
        <p className="text-sm text-red-500 mt-1">
          Please configure NEXT_PUBLIC_MAPBOX_TOKEN in your environment
        </p>
      </div>
    );
  }

  return (
    <div className={`mb-4 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      
      <AddressAutofill
        accessToken={mapboxToken}
        onRetrieve={handleRetrieve}
        options={{
          country: 'CA', // Focus on Canada
          language: 'en',
          limit: 5
        }}
      >
        <input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all duration-200"
          autoComplete="address-line1"
        />
      </AddressAutofill>
      
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Start typing to search for Canadian addresses
      </p>
    </div>
  );
}