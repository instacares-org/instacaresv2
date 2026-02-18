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

// Province name to 2-letter code mapping for consistent timezone lookups
const PROVINCE_TO_CODE: { [key: string]: string } = {
  'ontario': 'ON',
  'quebec': 'QC',
  'british columbia': 'BC',
  'alberta': 'AB',
  'manitoba': 'MB',
  'saskatchewan': 'SK',
  'nova scotia': 'NS',
  'new brunswick': 'NB',
  'newfoundland and labrador': 'NL',
  'newfoundland': 'NL',
  'prince edward island': 'PE',
  'northwest territories': 'NT',
  'nunavut': 'NU',
  'yukon': 'YT',
  // Already 2-letter codes (pass through)
  'on': 'ON', 'qc': 'QC', 'bc': 'BC', 'ab': 'AB', 'mb': 'MB',
  'sk': 'SK', 'ns': 'NS', 'nb': 'NB', 'nl': 'NL', 'pe': 'PE',
  'nt': 'NT', 'nu': 'NU', 'yt': 'YT'
};

// Normalize province to 2-letter code for consistent timezone lookups
function normalizeProvince(province: string): string {
  if (!province) return 'ON'; // Default to Ontario
  const normalized = PROVINCE_TO_CODE[province.toLowerCase().trim()];
  return normalized || province; // Return original if not found (might already be a code)
}

export interface MapboxAddressAutocompleteProps {
  label?: string;
  placeholder?: string;
  onAddressSelect: (address: AddressData) => void;
  defaultValue?: string;
  className?: string;
  required?: boolean;
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
        full_address: properties.full_address,
        place: properties.place,
        locality: properties.locality,
        district: properties.district,
        region: properties.region,
        postcode: properties.postcode,
        context: properties.context
      });

      // Extract address components
      // Use address_line1 if available (it usually includes the full street address)
      // Otherwise, combine address_number with street name, or fall back to place_name
      const streetAddress = properties.address_line1 ||
        [properties.address_number, properties.address_line2].filter(Boolean).join(' ') ||
        properties.place_name || '';

      // For city: check place, locality, district, then fallback to context array or place_name parsing
      let city = properties.place || properties.locality || properties.district || '';
      let state = properties.region || properties.state || '';
      const zipCode = properties.postcode || '';
      let country = properties.country || 'Canada';

      // If city/state not found in direct properties, try context array (used for POIs)
      if ((!city || !state) && properties.context) {
        for (const ctx of properties.context) {
          if (!city && (ctx.id?.startsWith('place.') || ctx.id?.startsWith('locality.'))) {
            city = ctx.text || '';
          }
          if (!state && ctx.id?.startsWith('region.')) {
            state = ctx.text || ctx.short_code?.replace('CA-', '') || '';
          }
          if (!country && ctx.id?.startsWith('country.')) {
            country = ctx.text || 'Canada';
          }
        }
      }

      // Last resort: try to parse city/province from full_address or place_name
      // Format is typically "Address, City, Province PostalCode, Country"
      if (!city || !state) {
        const fullAddress = properties.full_address || properties.place_name || '';
        const parts = fullAddress.split(',').map((p: string) => p.trim());

        if (parts.length >= 3) {
          // Second-to-last part often contains "Province PostalCode"
          const provincePostal = parts[parts.length - 2];
          const cityPart = parts[parts.length - 3];

          if (!city && cityPart) {
            city = cityPart;
          }

          if (!state && provincePostal) {
            // Extract province code (ON, BC, AB, etc.) from "Ontario M9W 5L4" or similar
            const provinceMatch = provincePostal.match(/^(Ontario|British Columbia|Alberta|Quebec|Manitoba|Saskatchewan|Nova Scotia|New Brunswick|Newfoundland|Prince Edward Island|Northwest Territories|Nunavut|Yukon|ON|BC|AB|QC|MB|SK|NS|NB|NL|PE|NT|NU|YT)\b/i);
            if (provinceMatch) {
              state = provinceMatch[1];
            }
          }
        }
      }
      
      // Extract coordinates
      const coordinates = geometry?.coordinates;
      const longitude = coordinates?.[0];
      const latitude = coordinates?.[1];

      // Normalize province to 2-letter code for consistent timezone lookups
      const normalizedState = normalizeProvince(state.trim());

      // Normalize country to ISO 3166-1 alpha-2 code (required by Stripe)
      const normalizeCountry = (countryName: string): string => {
        const countryMap: { [key: string]: string } = {
          'canada': 'CA',
          'united states': 'US',
          'usa': 'US',
          'united states of america': 'US',
          'united kingdom': 'GB',
          'uk': 'GB',
          'great britain': 'GB',
        };
        const normalized = countryMap[countryName.toLowerCase()];
        // If already a 2-letter code, return as-is uppercase
        if (countryName.length === 2) {
          return countryName.toUpperCase();
        }
        return normalized || countryName;
      };

      const addressData: AddressData = {
        streetAddress: streetAddress.trim(),
        apartment: '', // Apartment/unit to be filled manually
        city: city.trim(),
        state: normalizedState,
        zipCode: zipCode.trim(),
        country: normalizeCountry(country.trim()),
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
          placeholder="Enter your address manually..."
          className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-600 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all duration-200"
          onChange={(e) => {
            // Simple fallback - just capture the address as entered
            const address = e.target.value;
            if (address.length > 5) {
              const addressData: AddressData = {
                streetAddress: address,
                apartment: '',
                city: 'Toronto', // Default city for development
                state: 'ON',     // Default province
                zipCode: '',     // To be filled manually
                country: 'Canada',
                latitude: 43.6532, // Default Toronto coordinates
                longitude: -79.3832
              };
              onAddressSelect(addressData);
            }
          }}
        />
        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">
            Development Mode - Manual Address Entry
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Mapbox is disabled to avoid conflicts with production (instacares.net).
            Type your address above - it will use Toronto, ON as default location.
          </p>
          <details className="mt-2">
            <summary className="text-xs text-blue-500 cursor-pointer hover:underline">
              Want full Mapbox autocomplete?
            </summary>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <p>1. Create a new development token at <a href="https://www.mapbox.com/" target="_blank" className="text-blue-500 underline">mapbox.com</a></p>
              <p>2. Add it to your .env.local: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN="your_dev_token"</code></p>
              <p>3. Restart your development server</p>
            </div>
          </details>
        </div>
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