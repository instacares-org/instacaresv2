'use client';

import dynamic from 'next/dynamic';
import { AddressData } from './MapboxAddressAutocomplete';

interface MapboxAddressAutocompleteProps {
  label?: string;
  placeholder?: string;
  onAddressSelect: (address: AddressData) => void;
  defaultValue?: string;
  className?: string;
}

// Dynamic import with no SSR to avoid document reference errors
const MapboxAddressAutocomplete = dynamic(
  () => import('./MapboxAddressAutocomplete'),
  {
    ssr: false,
    loading: () => (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Address
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 animate-pulse">
          Loading address search...
        </div>
      </div>
    )
  }
);

export default function MapboxAddressAutocompleteDynamic(props: MapboxAddressAutocompleteProps) {
  return <MapboxAddressAutocomplete {...props} />;
}