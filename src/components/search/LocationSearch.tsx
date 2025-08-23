"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

interface LocationSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: string) => void;
  placeholder?: string;
  className?: string;
}

// Popular locations data
const popularLocations = [
  // US Major Cities
  "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
  "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "San Jose, CA",
  "Austin, TX", "Jacksonville, FL", "Fort Worth, TX", "Columbus, OH", "Charlotte, NC",
  "San Francisco, CA", "Indianapolis, IN", "Seattle, WA", "Denver, CO", "Washington, DC",
  "Boston, MA", "El Paso, TX", "Nashville, TN", "Detroit, MI", "Oklahoma City, OK",
  "Portland, OR", "Las Vegas, NV", "Memphis, TN", "Louisville, KY", "Baltimore, MD",
  
  // US States
  "California", "Texas", "Florida", "New York", "Pennsylvania", "Illinois", "Ohio",
  "Georgia", "North Carolina", "Michigan", "New Jersey", "Virginia", "Washington",
  "Arizona", "Massachusetts", "Tennessee", "Indiana", "Missouri", "Maryland",
  "Wisconsin", "Colorado", "Minnesota", "South Carolina", "Alabama", "Louisiana",
  
  // Canadian Cities
  "Toronto, ON", "Montreal, QC", "Vancouver, BC", "Calgary, AB", "Edmonton, AB",
  "Ottawa, ON", "Winnipeg, MB", "Quebec City, QC", "Hamilton, ON", "Kitchener, ON",
  
  // Canadian Provinces
  "Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Saskatchewan",
  "Nova Scotia", "New Brunswick", "Newfoundland and Labrador", "Prince Edward Island"
];

const LocationSearch: React.FC<LocationSearchProps> = ({
  value,
  onChange,
  onSelect,
  placeholder = "Enter city, state or province...",
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (value.length > 0) {
      const filtered = popularLocations
        .filter(loc => loc.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 8);
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions(popularLocations.slice(0, 6));
    }
    setActiveSuggestionIndex(-1);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
  };

  const handleSuggestionSelect = (suggestion: string) => {
    onSelect(suggestion);
    setIsOpen(false);
    setActiveSuggestionIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (activeSuggestionIndex >= 0 && activeSuggestionIndex < filteredSuggestions.length) {
          handleSuggestionSelect(filteredSuggestions[activeSuggestionIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setActiveSuggestionIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleFocus = () => setIsOpen(true);
  
  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking on a suggestion
    if (e.relatedTarget && listRef.current?.contains(e.relatedTarget as Node)) {
      return;
    }
    setTimeout(() => setIsOpen(false), 100);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <MapPinIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-colors"
          aria-label="Search location"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            activeSuggestionIndex >= 0 
              ? `suggestion-${activeSuggestionIndex}` 
              : undefined
          }
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {filteredSuggestions.length > 0 ? (
            <>
              {value.length === 0 && (
                <div className="px-4 py-2 text-sm font-medium text-gray-700 border-b border-gray-100">
                  Popular locations
                </div>
              )}
              <ul ref={listRef} role="listbox" aria-label="Location suggestions">
                {filteredSuggestions.map((suggestion, index) => (
                  <li key={suggestion} role="option" aria-selected={index === activeSuggestionIndex}>
                    <button
                      id={`suggestion-${index}`}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className={cn(
                        "w-full text-left px-4 py-3 text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none transition-colors border-b border-gray-50 last:border-b-0",
                        index === activeSuggestionIndex && "bg-rose-50 text-rose-700"
                      )}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                    >
                      <div className="flex items-center space-x-3">
                        <MapPinIcon className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{suggestion}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              <p className="text-sm">No locations found matching "{value}"</p>
              <p className="text-xs text-gray-400 mt-1">Try searching for a city or state/province</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationSearch;