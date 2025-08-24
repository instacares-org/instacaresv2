"use client";

import Image from "next/image";
import OptimizedImage from "./OptimizedImage";
import { GlobeAltIcon, MagnifyingGlassIcon, UserCircleIcon, Bars3BottomLeftIcon, CalendarDaysIcon, UserGroupIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid";
import { useState, useCallback, useMemo } from "react";
import Calendar from "./Calendar";
import Link from "next/link";
import SignupModal from "./SignupModal";
import LoginModal from "./LoginModal";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "./ThemeToggle";

interface FilterState {
  priceRange: string;
  ageGroups: string[];
  specialServices: string[];
  experience: string;
  availability: string[];
  highlyRated: boolean;
  sortBy: string;
}

interface HeaderProps {
  activeFilters?: FilterState;
  onFiltersChange?: (filters: FilterState) => void;
}

function Header({ activeFilters, onFiltersChange }: HeaderProps = {}) {
  const { user, isAuthenticated, logout } = useAuth();
  const [activeField, setActiveField] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [infantCount, setInfantCount] = useState(0);
  const [childrenCount, setChildrenCount] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [location, setLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginUserType, setLoginUserType] = useState<'parent' | 'caregiver' | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Local filter state when not connected to search page
  const [localFilters, setLocalFilters] = useState<FilterState>({
    priceRange: 'any',
    ageGroups: [],
    specialServices: [],
    experience: 'any',
    availability: [],
    highlyRated: false,
    sortBy: 'recommended'
  });
  
  // Use passed filters or local state
  const currentFilters = activeFilters || localFilters;
  const updateFilters = onFiltersChange || setLocalFilters;

  // Popular Canadian cities and provinces
  const popularLocations = [
    // Major Canadian Cities
    "Toronto, ON", "Montreal, QC", "Vancouver, BC", "Calgary, AB", "Edmonton, AB",
    "Ottawa, ON", "Winnipeg, MB", "Quebec City, QC", "Hamilton, ON", "Kitchener, ON",
    "London, ON", "Victoria, BC", "Halifax, NS", "Oshawa, ON", "Windsor, ON",
    "Saskatoon, SK", "Regina, SK", "Sherbrooke, QC", "St. John's, NL", "Barrie, ON",
    "Kelowna, BC", "Abbotsford, BC", "Greater Sudbury, ON", "Kingston, ON", "Saguenay, QC",
    "Thunder Bay, ON", "Saint John, NB", "Moncton, NB", "Kamloops, BC", "Fredericton, NB",
    "Red Deer, AB", "Lethbridge, AB", "Nanaimo, BC", "Brantford, ON", "Saint-Jérôme, QC",
    "Drummondville, QC", "Fort McMurray, AB", "Peterborough, ON", "Prince George, BC",
    "Sault Ste. Marie, ON", "Sarnia, ON", "Wood Buffalo, AB", "New Westminster, BC",
    "Châteauguay, QC", "Granby, QC", "Saint-Hyacinthe, QC", "Shawinigan, QC", "Joliette, QC",
    "Victoriaville, QC", "Belleville, ON", "Charlottetown, PE", "Fredericton, NB",
    "Corner Brook, NL", "Yellowknife, NT", "Whitehorse, YT", "Iqaluit, NU",
    
    // Canadian Provinces & Territories  
    "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
    "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
    "Quebec", "Saskatchewan", "Yukon",
    
    // Popular Regions/Areas
    "Greater Toronto Area (GTA)", "Greater Vancouver Area", "National Capital Region",
    "Waterloo Region", "Niagara Region", "Durham Region", "Peel Region", "York Region",
    "Fraser Valley", "Lower Mainland", "Montreal Metropolitan Area", "Quebec City Area"
  ];

  const handleDateSelect = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
    if (start && end) {
      setActiveField(null);
    }
  };

  // Debounced location filtering for performance
  const filterLocations = useCallback((value: string) => {
    if (value.length > 0) {
      const filtered = popularLocations.filter(loc =>
        loc.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 8);
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions([]);
    }
  }, []);

  const debouncedFilterLocations = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (value: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => filterLocations(value), 300);
    };
  }, [filterLocations]);

  const handleLocationChange = (value: string) => {
    setLocation(value);
    setActiveSuggestionIndex(-1);
    debouncedFilterLocations(value);
  };

  const handleLocationSelect = (selectedLocation: string) => {
    setLocation(selectedLocation);
    setFilteredSuggestions([]);
    setActiveSuggestionIndex(-1);
    setActiveField(null);
  };

  const handleLocationKeyDown = (e: React.KeyboardEvent) => {
    if (filteredSuggestions.length === 0) return;

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
        if (activeSuggestionIndex >= 0) {
          handleLocationSelect(filteredSuggestions[activeSuggestionIndex]);
        }
        break;
      case 'Escape':
        setActiveField(null);
        break;
    }
  };

  const formatDateRange = () => {
    if (startDate && endDate) {
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    return "Any week";
  };

  const formatChildrenCount = () => {
    const total = infantCount + childrenCount;
    if (total === 0) return "Add children";
    if (total === 1) return "1 child";
    return `${total} children`;
  };

  const handleLogout = async () => {
    await logout();
    setShowUserMenu(false);
  };

  const handleLoginClick = (type: 'parent' | 'caregiver') => {
    setLoginUserType(type);
    setShowLoginModal(true);
    setShowUserMenu(false);
  };

  const buildSearchUrl = () => {
    const params = new URLSearchParams();
    
    // Add location if selected
    if (location) {
      params.set('location', location);
    }
    
    // Add dates if selected
    if (startDate) {
      params.set('startDate', startDate.toISOString());
    }
    if (endDate) {
      params.set('endDate', endDate.toISOString());
    }
    
    // Add children counts if specified
    if (infantCount > 0) {
      params.set('infants', infantCount.toString());
    }
    if (childrenCount > 0) {
      params.set('children', childrenCount.toString());
    }
    
    const queryString = params.toString();
    return `/search${queryString ? `?${queryString}` : ''}`;
  };
  return (
    <>
    <header className="sticky top-0 z-50 grid grid-cols-3 items-center bg-white dark:bg-gray-800 shadow-md p-2 transition-colors duration-200">
      {/* Left */}
      <div className="flex items-center h-12 cursor-pointer my-auto w-20">
        <div suppressHydrationWarning>
          <Image
            src="/logo.png"
            width={80}
            height={50}
            alt="Instacares Logo"
            className="object-contain w-full h-auto"
            priority={true}
          />
        </div>
      </div>
      {/* Middle - Interactive Search Bar */}
      <div className="flex items-center justify-center relative">
        <div className="hidden md:flex items-center border border-gray-300 dark:border-gray-600 rounded-full py-2 px-4 shadow-sm hover:shadow-md transition bg-white dark:bg-gray-800">
          
          {/* Location */}
          <div 
            className={`text-sm px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full py-1 ${location ? 'font-medium text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}
            onClick={() => setActiveField(activeField === 'location' ? null : 'location')}
          >
            {location || "Where in Canada?"}
          </div>
          <div className="border-l border-gray-300 dark:border-gray-600 h-4 mx-2"></div>
          
          {/* Dates */}
          <div 
            className={`text-sm px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full py-1 ${startDate && endDate ? 'font-medium text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}
            onClick={() => setActiveField(activeField === 'dates' ? null : 'dates')}
          >
            {formatDateRange()}
          </div>
          <div className="border-l border-gray-300 dark:border-gray-600 h-4 mx-2"></div>
          
          {/* Children */}
          <div 
            className={`text-sm px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full py-1 ${(infantCount + childrenCount) > 0 ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
            onClick={() => setActiveField(activeField === 'children' ? null : 'children')}
          >
            {formatChildrenCount()}
          </div>
          
          <Link 
            href={buildSearchUrl()}
            onClick={() => {
              // Close all dropdowns when search is clicked
              setActiveField(null);
              setShowUserMenu(false);
              setShowFilters(false);
            }}
          >
            <MagnifyingGlassIcon className="h-8 w-8 bg-rose-500 text-white rounded-full p-2 ml-2 cursor-pointer hover:bg-rose-600 transition" />
          </Link>
        </div>
        <AdjustmentsHorizontalIcon 
          className="h-8 w-8 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full p-2 ml-2 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200" 
          onClick={() => setShowFilters(!showFilters)}
        />
      </div>

      {/* Right */}
      <div className="flex items-center space-x-3 justify-end text-gray-500 dark:text-gray-400">
          {!isAuthenticated && (
            <button 
              onClick={() => setShowSignupModal(true)}
              className="hidden md:inline-flex cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition"
            >
              Sign Up
            </button>
          )}
          <ThemeToggle />
          <GlobeAltIcon className="h-5 cursor-pointer" />

        <div 
          className="flex items-center space-x-2 border-2 p-1 rounded-full cursor-pointer hover:shadow-md transition relative"
          onClick={() => setShowUserMenu(!showUserMenu)}
        >
          <Bars3BottomLeftIcon className="h-6" />
          {isAuthenticated && user?.profile ? (
            <div className="w-6 h-6 rounded-full overflow-hidden">
              {user.profile.avatar ? (
                <OptimizedImage 
                  src={user.profile.avatar} 
                  alt={`${user.profile.firstName} ${user.profile.lastName}`}
                  width={24}
                  height={24}
                  className="w-full h-full rounded-full"
                  priority={false}
                  sizes="24px"
                  onError={() => {
                    // Avatar loading handled by OptimizedImage fallback
                  }}
                />
              ) : null}
              <UserCircleIcon className="h-6" style={{ display: user.profile.avatar ? 'none' : 'block' }} />
            </div>
          ) : (
            <UserCircleIcon className="h-6" />
          )}
        </div>
      </div>
    </header>

    {/* Dropdown Menus */}
    <div className="relative">
      
      {/* Calendar Dropdown */}
      {activeField === 'dates' && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl z-40 w-fit transition-colors duration-200">
          <Calendar onDateSelect={handleDateSelect} />
        </div>
      )}

      {/* Children Count Dropdown */}
      {activeField === 'children' && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-2xl border border-gray-100 dark:border-gray-700 p-6 z-40 w-96 transition-colors duration-200">
          <div className="space-y-6">
            <div className="text-center border-b border-gray-100 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">👶 How many children?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Select the number of children you need care for</p>
            </div>
            
            <div className="flex justify-between items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  🍼 <span className="ml-2">Infants</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 ml-6">Under 2 years</p>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setInfantCount(Math.max(0, infantCount - 1))}
                  className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center hover:border-rose-400 dark:hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-gray-700 dark:text-gray-300 font-medium"
                  disabled={infantCount === 0}
                >
                  −
                </button>
                <span className="w-10 text-center font-semibold text-lg text-gray-900 dark:text-gray-100">{infantCount}</span>
                <button 
                  onClick={() => setInfantCount(infantCount + 1)}
                  className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center hover:border-rose-400 dark:hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200 text-gray-700 dark:text-gray-300 font-medium"
                >
                  +
                </button>
              </div>
            </div>
            
            <div className="flex justify-between items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  🧒 <span className="ml-2">Children</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 ml-6">Ages 2-12</p>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                  className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center hover:border-rose-400 dark:hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-gray-700 dark:text-gray-300 font-medium"
                  disabled={childrenCount === 0}
                >
                  −
                </button>
                <span className="w-10 text-center font-semibold text-lg text-gray-900 dark:text-gray-100">{childrenCount}</span>
                <button 
                  onClick={() => setChildrenCount(childrenCount + 1)}
                  className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex items-center justify-center hover:border-rose-400 dark:hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200 text-gray-700 dark:text-gray-300 font-medium"
                >
                  +
                </button>
              </div>
            </div>
            
            {(infantCount > 0 || childrenCount > 0) && (
              <div className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-rose-200 dark:border-rose-800">
                <div className="flex items-center justify-center space-x-2">
                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                    ✨ Total: {infantCount + childrenCount} child{(infantCount + childrenCount) > 1 ? 'ren' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Filter Dropdown */}
      {showFilters && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top-5 duration-300">
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 w-[420px] flex flex-col max-h-[80vh] backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-gray-800 dark:to-gray-850 px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-rose-500 to-pink-600 rounded-xl flex items-center justify-center">
                    <AdjustmentsHorizontalIcon className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Smart Filters</h3>
                </div>
                <button 
                  onClick={() => setShowFilters(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              
              {/* Price Range - Elegant Card Style */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  <span className="text-lg">💰</span>
                  <span>Price Range</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Any price", value: "any", popular: true },
                    { label: "$15-25/hr", value: "15-25" },
                    { label: "$25-35/hr", value: "25-35", popular: true },
                    { label: "$35-45/hr", value: "35-45" },
                    { label: "$45+/hr", value: "45+" }
                  ].map((option, index) => (
                    <label key={option.value} className="relative cursor-pointer group">
                      <input 
                        type="radio" 
                        name="priceRange" 
                        value={option.value}
                        className="sr-only peer"
                        checked={currentFilters.priceRange === option.value}
                        onChange={(e) => updateFilters({ ...currentFilters, priceRange: e.target.value })}
                      />
                      <div className={`p-3 rounded-xl border-2 transition-all duration-200 text-center relative
                        ${option.popular ? 'ring-1 ring-rose-200 dark:ring-rose-800' : ''}
                        peer-checked:border-rose-500 peer-checked:bg-rose-50 dark:peer-checked:bg-rose-900/20 
                        border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-600
                        group-hover:shadow-md`}>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 peer-checked:text-rose-700 dark:peer-checked:text-rose-300">
                          {option.label}
                        </span>
                        {option.popular && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-rose-500 to-pink-600 rounded-full flex items-center justify-center">
                            <span className="text-[8px] font-bold text-white">🔥</span>
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Age Groups - Toggle Pills */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  <span className="text-lg">👶</span>
                  <span>Age Groups</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Infants (0-2)", emoji: "🍼", value: "infants" },
                    { label: "Toddlers (2-4)", emoji: "🧸", value: "toddlers" },
                    { label: "School age (5-12)", emoji: "🎒", value: "schoolage" },
                    { label: "Teens (13+)", emoji: "📱", value: "teens" }
                  ].map((age) => (
                    <label key={age.label} className="cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={currentFilters.ageGroups.includes(age.value)}
                        onChange={(e) => {
                          const newAgeGroups = e.target.checked 
                            ? [...currentFilters.ageGroups, age.value]
                            : currentFilters.ageGroups.filter(a => a !== age.value);
                          updateFilters({ ...currentFilters, ageGroups: newAgeGroups });
                        }}
                      />
                      <div className="flex items-center space-x-2 px-4 py-2 rounded-full border-2 border-gray-200 dark:border-gray-700 
                        peer-checked:border-rose-500 peer-checked:bg-rose-50 dark:peer-checked:bg-rose-900/20 
                        hover:border-rose-300 dark:hover:border-rose-600 transition-all duration-200 
                        hover:shadow-sm">
                        <span className="text-sm">{age.emoji}</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{age.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Special Services - Card Style */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  <span className="text-lg">⭐</span>
                  <span>Special Services</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Special needs", short: "Special needs", icon: "🤗", premium: true, value: "special-needs" },
                    { label: "Bilingual", short: "Bilingual", icon: "🌍", value: "bilingual" },
                    { label: "Homework help", short: "Homework", icon: "📚", value: "homework" },
                    { label: "Meal prep", short: "Meals", icon: "🍎", value: "meals" },
                    { label: "Housekeeping", short: "Cleaning", icon: "🧹", value: "housekeeping" },
                    { label: "Transportation", short: "Transport", icon: "🚗", value: "transportation" }
                  ].map((service) => (
                    <label key={service.label} className="cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={currentFilters.specialServices.includes(service.value)}
                        onChange={(e) => {
                          const newServices = e.target.checked 
                            ? [...currentFilters.specialServices, service.value]
                            : currentFilters.specialServices.filter(s => s !== service.value);
                          updateFilters({ ...currentFilters, specialServices: newServices });
                        }}
                      />
                      <div className={`flex items-center space-x-2 p-2.5 rounded-xl border-2 transition-all duration-200 relative
                        ${service.premium ? 'bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/10 dark:to-yellow-900/10' : ''}
                        peer-checked:border-rose-500 peer-checked:bg-rose-50 dark:peer-checked:bg-rose-900/20 
                        border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-600
                        group-hover:shadow-sm`}>
                        <span className="text-sm">{service.icon}</span>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1">{service.short}</span>
                        {service.premium && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-full flex items-center justify-center">
                            <span className="text-[6px] font-bold text-white">★</span>
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Experience Level - Compact Grid */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  <span className="text-lg">🌟</span>
                  <span>Experience Level</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Any experience", short: "Any", value: "any" },
                    { label: "New (0-2 years)", short: "New", value: "new" },
                    { label: "Experienced (3-7 years)", short: "Experienced", value: "experienced" },
                    { label: "Expert (8+ years)", short: "Expert", value: "expert" }
                  ].map((exp, index) => (
                    <label key={exp.label} className="cursor-pointer">
                      <input 
                        type="radio" 
                        name="experience" 
                        className="sr-only peer" 
                        value={exp.value}
                        checked={currentFilters.experience === exp.value}
                        onChange={(e) => updateFilters({ ...currentFilters, experience: e.target.value })}
                      />
                      <div className="p-2.5 rounded-xl border-2 text-center transition-all duration-200
                        peer-checked:border-rose-500 peer-checked:bg-rose-50 dark:peer-checked:bg-rose-900/20 
                        border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-600 
                        hover:shadow-sm">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{exp.short}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Quick Availability */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  <span className="text-lg">⚡</span>
                  <span>Quick Availability</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Available today", urgent: true, value: "available-today" },
                    { label: "This week", popular: true, value: "this-week" },
                    { label: "Weekdays only", value: "weekdays" },
                    { label: "Weekends only", value: "weekends" },
                    { label: "Evenings available", value: "evenings" },
                    { label: "Overnight care", value: "overnight" }
                  ].map((avail) => (
                    <label key={avail.label} className="cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={currentFilters.availability.includes(avail.value)}
                        onChange={(e) => {
                          const newAvailability = e.target.checked 
                            ? [...currentFilters.availability, avail.value]
                            : currentFilters.availability.filter(a => a !== avail.value);
                          updateFilters({ ...currentFilters, availability: newAvailability });
                        }}
                      />
                      <div className={`flex items-center space-x-2 px-3 py-2 rounded-full border-2 text-sm font-medium transition-all duration-200
                        ${avail.urgent ? 'border-orange-300 bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300' : 
                          avail.popular ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300' :
                          'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'}
                        peer-checked:border-rose-500 peer-checked:bg-rose-50 dark:peer-checked:bg-rose-900/20 peer-checked:text-rose-700 dark:peer-checked:text-rose-300
                        hover:border-rose-300 dark:hover:border-rose-600 hover:shadow-sm`}>
                        {avail.urgent && <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>}
                        {avail.popular && <span className="text-blue-500">🔥</span>}
                        <span>{avail.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sort By */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  <span className="text-lg">🔄</span>
                  <span>Sort By</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Recommended", value: "recommended", popular: true },
                    { label: "Price: Low to High", value: "price-low" },
                    { label: "Price: High to Low", value: "price-high" },
                    { label: "Highest Rated", value: "rating-high" },
                    { label: "Most Reviews", value: "reviews-most" },
                    { label: "Newest First", value: "newest" }
                  ].map((option) => (
                    <label key={option.value} className="relative cursor-pointer group">
                      <input 
                        type="radio" 
                        name="sortBy" 
                        value={option.value}
                        className="sr-only peer"
                        checked={currentFilters.sortBy === option.value}
                        onChange={(e) => updateFilters({ ...currentFilters, sortBy: e.target.value })}
                      />
                      <div className={`p-2.5 rounded-xl border-2 transition-all duration-200 text-center relative
                        ${option.popular ? 'ring-1 ring-blue-200 dark:ring-blue-800' : ''}
                        peer-checked:border-rose-500 peer-checked:bg-rose-50 dark:peer-checked:bg-rose-900/20 
                        border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-600
                        group-hover:shadow-md`}>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 peer-checked:text-rose-700 dark:peer-checked:text-rose-300">
                          {option.label}
                        </span>
                        {option.popular && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full flex items-center justify-center">
                            <span className="text-[8px] font-bold text-white">⭐</span>
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Highly Rated Filter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                    <span className="text-lg">⭐</span>
                    <span>Quality</span>
                  </label>
                  <div className="flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={currentFilters.highlyRated}
                        onChange={(e) => updateFilters({ ...currentFilters, highlyRated: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-rose-600"></div>
                      <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                        Highly rated only (4.5+ ⭐)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex space-x-3">
                <button 
                  onClick={() => {
                    console.log('🧹 Clear All button clicked');
                    const clearedFilters = {
                      priceRange: 'any',
                      ageGroups: [],
                      specialServices: [],
                      experience: 'any',
                      availability: [],
                      highlyRated: false,
                      sortBy: 'recommended'
                    };
                    console.log('🧹 Clearing filters to:', clearedFilters);
                    updateFilters(clearedFilters);
                    // Close the filter dropdown after clearing
                    setShowFilters(false);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-red-300 dark:hover:border-red-600 transition-all duration-200"
                >
                  Clear All
                </button>
                <button 
                  onClick={() => setShowFilters(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-semibold hover:from-rose-600 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Show Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Autocomplete */}
      {activeField === 'location' && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-2xl border border-gray-100 dark:border-gray-700 z-40 w-96 transition-colors duration-200">
          <div className="p-6">
            <div className="space-y-5">
              <div className="text-center border-b border-gray-100 dark:border-gray-700 pb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center justify-center">
                  🇨🇦 <span className="ml-2">Where in Canada?</span>
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Search for your city or province</p>
              </div>
              
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Type a Canadian city or province..." 
                  value={location}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onKeyDown={handleLocationKeyDown}
                  className="w-full p-4 pl-12 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 rounded-xl outline-none focus:border-rose-500 dark:focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 dark:focus:ring-rose-400/20 transition-all duration-200 shadow-sm"
                  autoFocus
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <span className="text-xl">🔍</span>
                </div>
              </div>
              
              {filteredSuggestions.length > 0 ? (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1 mb-2">Search Results</h4>
                  <div className="max-h-64 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-600">
                    {filteredSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleLocationSelect(suggestion)}
                        className={`w-full text-left px-4 py-3 transition-all duration-200 border-b border-gray-200 dark:border-gray-700 last:border-b-0 first:rounded-t-xl last:rounded-b-xl ${
                          index === activeSuggestionIndex 
                            ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' 
                            : 'hover:bg-white dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                            index === activeSuggestionIndex 
                              ? 'bg-rose-200 dark:bg-rose-800' 
                              : 'bg-gray-200 dark:bg-gray-700'
                          }`}>
                            <span className="text-sm">🍁</span>
                          </div>
                          <div className="flex-1">
                            <span className="font-medium">{suggestion}</span>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {suggestion.includes(',') ? 'City' : 'Province/Territory'}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : location.length > 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-600">
                  <div className="text-4xl mb-3">🤔</div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No matches found for "{location}"</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Try searching for a Canadian city or province</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">Popular Destinations</h4>
                  <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                    {popularLocations.slice(0, 8).map((popularLocation, index) => (
                      <button
                        key={index}
                        onClick={() => handleLocationSelect(popularLocation)}
                        className="text-left px-4 py-3 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all duration-200 text-sm font-medium text-gray-700 dark:text-gray-300 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">🍁</span>
                          <span>{popularLocation}</span>
                          {index < 3 && (
                            <span className="ml-auto text-xs px-2 py-1 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-full font-medium">
                              Popular
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User Menu Dropdown */}
      {showUserMenu && (
        <div className="absolute top-2 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700 py-2 z-40 w-64 transition-colors duration-200">
          {!isAuthenticated ? (
            <>
              <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b dark:border-gray-700">
                Choose your login type
              </div>
              
              <button
                onClick={() => handleLoginClick('parent')}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center space-x-3"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <UserCircleIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">Parent Login</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Looking for childcare</div>
                </div>
              </button>
              
              <button
                onClick={() => handleLoginClick('caregiver')}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center space-x-3"
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <UserCircleIcon className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">Caregiver Login</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Offering childcare services</div>
                </div>
              </button>
            </>
          ) : (
            <>
              <div className="px-4 py-3 border-b">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                    {user?.profile?.avatar ? (
                      <OptimizedImage 
                        src={user.profile.avatar} 
                        alt={`${user.profile.firstName} ${user.profile.lastName}`}
                        width={40}
                        height={40}
                        className="w-full h-full rounded-full"
                        priority={false}
                        sizes="40px"
                      />
                    ) : (
                      <UserCircleIcon className="h-8 w-8 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {user?.profile?.firstName} {user?.profile?.lastName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {user?.userType?.toLowerCase()}
                    </div>
                  </div>
                </div>
              </div>
              
              <Link 
                href={user?.userType === 'PARENT' ? '/parent-dashboard' : '/caregiver-dashboard'} 
                className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                Dashboard
              </Link>
              
              <Link href="/bookings" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                My Bookings
              </Link>
              
              <Link href="/settings" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                Settings
              </Link>
              
              <div className="px-4 py-2">
                <ThemeToggle showLabel={true} className="w-full justify-start" />
              </div>
              
              <div className="border-t dark:border-gray-700 mt-2">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Overlay to close dropdowns */}
      {(activeField || showUserMenu || showFilters) && (
        <div 
          className="fixed inset-0 z-30 bg-black/10 backdrop-blur-sm"
          onClick={() => {
            setActiveField(null);
            setShowUserMenu(false);
            setShowFilters(false);
          }}
        />
      )}
    </div>

    {/* Signup Modal */}
    <SignupModal 
      isOpen={showSignupModal} 
      onClose={() => setShowSignupModal(false)} 
    />
    
    {/* Login Modal */}
    <LoginModal 
      isOpen={showLoginModal} 
      onClose={() => setShowLoginModal(false)}
      userType={loginUserType}
    />
    </>
  );
}

export default Header;
export type { FilterState };