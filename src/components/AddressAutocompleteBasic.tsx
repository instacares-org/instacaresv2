"use client";

import { useState } from 'react';

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

export default function AddressAutocompleteBasic({
  onAddressSelect,
  defaultValue = '',
  placeholder = 'Start typing your address...',
  className = '',
  label = 'Address',
  required = false,
  disabled = false
}: AddressAutocompleteProps) {
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const handleAddressChange = () => {
    onAddressSelect({
      streetAddress,
      city,
      state: province,
      zipCode: postalCode,
      country: 'Canada'
    });
  };

  const canadianProvinces = [
    { code: 'AB', name: '🏔️ Alberta' },
    { code: 'BC', name: '🌲 British Columbia' },
    { code: 'MB', name: '🌾 Manitoba' },
    { code: 'NB', name: '🦞 New Brunswick' },
    { code: 'NL', name: '🐋 Newfoundland & Labrador' },
    { code: 'NS', name: '⚓ Nova Scotia' },
    { code: 'ON', name: '🍁 Ontario' },
    { code: 'PE', name: '🥔 Prince Edward Island' },
    { code: 'QC', name: '⚜️ Quebec' },
    { code: 'SK', name: '🌾 Saskatchewan' },
    { code: 'NT', name: '❄️ Northwest Territories' },
    { code: 'NU', name: '🐻‍❄️ Nunavut' },
    { code: 'YT', name: '🏔️ Yukon' }
  ];

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      
      {/* Street Address */}
      <div>
        <input
          type="text"
          value={streetAddress}
          onChange={(e) => {
            setStreetAddress(e.target.value);
            handleAddressChange();
          }}
          placeholder="Street address (e.g., 123 Main St)"
          required={required}
          disabled={disabled}
          className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 dark:bg-gray-700 dark:text-white ${className}`}
        />
      </div>

      {/* City, Province, Postal Code */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <input
            type="text"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              handleAddressChange();
            }}
            placeholder="City"
            required={required}
            disabled={disabled}
            className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 dark:bg-gray-700 dark:text-white ${className}`}
          />
        </div>
        
        <div>
          <select
            value={province}
            onChange={(e) => {
              setProvince(e.target.value);
              handleAddressChange();
            }}
            required={required}
            disabled={disabled}
            className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 dark:bg-gray-700 dark:text-white appearance-none ${className}`}
          >
            <option value="">Province</option>
            {canadianProvinces.map(prov => (
              <option key={prov.code} value={prov.code}>{prov.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => {
              const formatted = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
              if (formatted.length <= 6) {
                const postal = formatted.length > 3 
                  ? `${formatted.slice(0, 3)} ${formatted.slice(3)}`
                  : formatted;
                setPostalCode(postal);
                handleAddressChange();
              }
            }}
            placeholder="A1A 1A1"
            maxLength={7}
            required={required}
            disabled={disabled}
            className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 dark:bg-gray-700 dark:text-white ${className}`}
          />
        </div>
      </div>

      {/* Address Preview */}
      {(streetAddress || city || province || postalCode) && (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">📍 Address Preview:</div>
          <div className="text-sm text-gray-800 dark:text-gray-200">
            {streetAddress && <div>{streetAddress}</div>}
            <div className="flex gap-2">
              {city && <span>{city}</span>}
              {province && <span>{province}</span>}
              {postalCode && <span>{postalCode}</span>}
            </div>
          </div>
        </div>
      )}
      
      <p className="text-xs text-gray-500 dark:text-gray-400">
        🇨🇦 Manual Canadian address entry
      </p>
    </div>
  );
}