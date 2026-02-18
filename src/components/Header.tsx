"use client";

import Image from "next/image";
import OptimizedImage from "./OptimizedImage";
import { MagnifyingGlassIcon, UserCircleIcon, Bars3BottomLeftIcon, CalendarDaysIcon, UserGroupIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/solid";
import { useState, useCallback, useMemo, useEffect } from "react";
import Calendar from "./Calendar";
import Link from "next/link";
import SignupModal from "./SignupModal";
import LoginModal from "./LoginModal";
import AddCaregiverRoleModal from "./AddCaregiverRoleModal";
import { useAuth } from "../contexts/AuthContext";
import ThemeToggle from "./ThemeToggle";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "../contexts/LanguageContext";

interface FilterState {
  providerType: string;
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
  const { user, isAuthenticated, logout, refreshUser, hasDualRole, switchRole } = useAuth();
  const { t, locale } = useLanguage();
  const [showOAuthCompletionModal, setShowOAuthCompletionModal] = useState(false);
  // Track if user has completed profile in this session to prevent modal from reopening
  const [profileCompletedInSession, setProfileCompletedInSession] = useState(false);

  // State to track OAuth signup user type from localStorage
  const [oauthUserTypeFromStorage, setOauthUserTypeFromStorage] = useState<'parent' | 'caregiver' | null>(null);

  // Show OAuth profile completion modal when user needs to complete their profile
  // BUT NOT on dashboard pages - those pages handle their own OAuth modals with proper userType context
  useEffect(() => {
    // Small delay to ensure we're on the correct page after OAuth redirect
    // Without this, the check might run before Next.js client-side navigation completes
    const timeoutId = setTimeout(() => {
      // Check if we're on a dashboard page OR if there's an OAuth callback - if so, let the dashboard handle the modal
      const isDashboardPage = typeof window !== 'undefined' &&
        (window.location.pathname.includes('/caregiver-dashboard') ||
         window.location.pathname.includes('/parent-dashboard') ||
         window.location.pathname.includes('/babysitter-dashboard'));

      // Also check for OAuth callback URL parameters - dashboards handle these
      const isOAuthCallback = typeof window !== 'undefined' &&
        (window.location.search.includes('oauth=true') ||
         window.location.search.includes('userType='));

      // Check localStorage for OAuth signup user type (stored before OAuth redirect)
      let storedUserType: 'parent' | 'caregiver' | null = null;
      if (typeof window !== 'undefined') {
        const storedType = localStorage.getItem('oauthSignupUserType');
        const storedTimestamp = localStorage.getItem('oauthSignupTimestamp');

        // Only use stored value if it's recent (within last 5 minutes)
        if (storedType && storedTimestamp) {
          const elapsed = Date.now() - parseInt(storedTimestamp);
          if (elapsed < 5 * 60 * 1000) { // 5 minutes
            storedUserType = storedType as 'parent' | 'caregiver';
            console.log('Header: Found valid oauthSignupUserType in localStorage:', storedUserType);
          } else {
            // Clear expired values
            localStorage.removeItem('oauthSignupUserType');
            localStorage.removeItem('oauthSignupTimestamp');
          }
        }
      }

      // If we found a stored user type, save it to state
      if (storedUserType && !oauthUserTypeFromStorage) {
        setOauthUserTypeFromStorage(storedUserType);
      }

      // Combined check - skip Header modal if on dashboard OR if OAuth callback
      const shouldSkipHeaderModal = isDashboardPage || isOAuthCallback;

      console.log('Header OAuth check:', {
        isAuthenticated,
        needsProfileCompletion: user?.needsProfileCompletion,
        userId: user?.id,
        userEmail: user?.email,
        profileCompletedInSession,
        isDashboardPage,
        isOAuthCallback,
        shouldSkipHeaderModal,
        storedUserType,
        pathname: typeof window !== 'undefined' ? window.location.pathname : 'SSR'
      });

      // If user is authenticated but does NOT need profile completion, clear the localStorage
      // This handles the case where an existing user logs in via OAuth - they don't need signup flow
      if (isAuthenticated && user?.needsProfileCompletion === false && storedUserType) {
        console.log('Header: User authenticated with complete profile, clearing OAuth signup localStorage');
        localStorage.removeItem('oauthSignupUserType');
        localStorage.removeItem('oauthSignupTimestamp');
        // Don't proceed with caregiver redirect - user already has a profile
        return;
      }

      // Only show modal if:
      // 1. User is authenticated
      // 2. User needs profile completion
      // 3. User hasn't already completed profile in this session
      // 4. Modal isn't already showing
      // 5. NOT on a dashboard page and NOT an OAuth callback (dashboards handle their own modals with proper userType)
      if (isAuthenticated && user?.needsProfileCompletion === true && !profileCompletedInSession && !showOAuthCompletionModal && !shouldSkipHeaderModal) {
        // Redirect users to their respective dashboards instead of showing Header modal
        // This ensures the profile completion modal appears on the dashboard with proper context
        // Clear localStorage before redirect
        localStorage.removeItem('oauthSignupUserType');
        localStorage.removeItem('oauthSignupTimestamp');

        if ((storedUserType as string) === 'babysitter' || user?.isBabysitter) {
          console.log('Header: Redirecting babysitter OAuth user to babysitter-dashboard');
          window.location.href = '/babysitter-dashboard';
          return;
        } else if (storedUserType === 'caregiver') {
          console.log('Header: Redirecting caregiver OAuth user to caregiver-dashboard');
          window.location.href = '/caregiver-dashboard?oauth=true&userType=caregiver';
          return;
        } else {
          // Redirect parents to parent-dashboard instead of showing modal here
          console.log('Header: Redirecting parent OAuth user to parent-dashboard');
          window.location.href = '/parent-dashboard?oauth=true&userType=parent';
          return;
        }
      }
    }, 100); // Small delay to allow page to settle

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, user?.needsProfileCompletion, user?.id, user?.email, profileCompletedInSession, showOAuthCompletionModal, oauthUserTypeFromStorage]);
  // Centralized overlay state - only one overlay can be open at a time
  // This ensures that opening one dropdown/modal automatically closes any other open overlay
  type OverlayType = 'location' | 'dates' | 'children' | 'userMenu' | 'filters' | null;
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);

  // Helper function to toggle an overlay - if it's already open, close it; otherwise open it and close others
  const toggleOverlay = (overlay: OverlayType) => {
    setActiveOverlay(current => current === overlay ? null : overlay);
  };

  // Helper to close all overlays
  const closeAllOverlays = () => setActiveOverlay(null);

  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [infantCount, setInfantCount] = useState(0);
  const [childrenCount, setChildrenCount] = useState(0);
  const [location, setLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [signupUserType, setSignupUserType] = useState<'parent' | 'caregiver'>('parent');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAddCaregiverModal, setShowAddCaregiverModal] = useState(false);
  const [loginUserType, setLoginUserType] = useState<'parent' | 'caregiver' | 'babysitter' | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Check for signup query parameter
  useEffect(() => {
    // Check if we're in the browser and have the signup parameter
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('signup') === 'true' && !isAuthenticated) {
        setShowSignupModal(true);
        // Remove the query parameter after opening the modal
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [isAuthenticated]);
  
  // Local filter state when not connected to search page
  const [localFilters, setLocalFilters] = useState<FilterState>({
    providerType: 'all',
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



  const handleDateSelect = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
    if (start && end) {
      closeAllOverlays();
    }
  };

  // Live Mapbox location search
  const filterLocations = useCallback(async (value: string) => {
    if (value.length < 2) {
      setFilteredSuggestions([]);
      return;
    }

    setIsLoadingSuggestions(true);
    
    try {
      const encodedQuery = encodeURIComponent(value);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?country=ca&types=place,region,postcode,locality&limit=8&access_token=${MAPBOX_TOKEN}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const suggestions = data.features.map((feature: any) => feature.place_name);
        setFilteredSuggestions(suggestions);
      } else {
        setFilteredSuggestions([]);
      }
    } catch (error) {
      console.error('Mapbox autocomplete error:', error);
      setFilteredSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [MAPBOX_TOKEN]);

  const debouncedFilterLocations = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    return (value: string) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        filterLocations(value);
      }, 300);
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
    closeAllOverlays();
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
        closeAllOverlays();
        break;
    }
  };

  const formatDateRange = () => {
    if (startDate && endDate) {
      const localeMap: Record<string, string> = {
        'en': 'en-US',
        'fr': 'fr-CA',
        'es': 'es-ES'
      };
      const dateLocale = localeMap[locale] || 'en-US';
      return `${startDate.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric' })}`;
    }
    return t('search.anyWeek');
  };

  const formatChildrenCount = () => {
    const total = infantCount + childrenCount;
    if (total === 0) return t('search.addChildren');
    if (total === 1) return `1 ${t('search.child')}`;
    return `${total} ${t('search.children')}`;
  };

  const handleLogout = async () => {
    await logout();
    closeAllOverlays();
  };

  const handleLoginClick = (type: 'parent' | 'caregiver' | 'babysitter') => {
    setLoginUserType(type);
    setShowLoginModal(true);
    closeAllOverlays();
  };

  const handleSignupClick = (type: 'parent' | 'caregiver' = 'parent') => {
    setSignupUserType(type);
    setShowSignupModal(true);
    closeAllOverlays();
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
      <Link href="/" className="flex items-center h-12 cursor-pointer my-auto w-20">
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
      </Link>
            {/* Middle - Interactive Search Bar */}
      <div className="flex items-center justify-center relative gap-3">
        {/* Desktop Search Bar - Full featured */}
        <div className="hidden md:flex items-center border border-gray-300 dark:border-gray-600 rounded-full py-2 px-4 shadow-sm hover:shadow-md transition bg-white dark:bg-gray-800 shrink-0">
          
          {/* Location */}
          <div
            className={`text-sm px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full py-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] ${location ? 'font-medium text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}
            onClick={() => toggleOverlay('location')}
          >
            {location || t('header.whereInCanada')}
          </div>
          <div className="border-l border-gray-300 dark:border-gray-600 h-4 mx-2"></div>
          
          {/* Dates */}
          <div
            className={`text-sm px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full py-1 whitespace-nowrap ${startDate && endDate ? 'font-medium text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}
            onClick={() => toggleOverlay('dates')}
          >
            {formatDateRange()}
          </div>
          <div className="border-l border-gray-300 dark:border-gray-600 h-4 mx-2"></div>
          
          {/* Children */}
          <div
            className={`text-sm px-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-full py-1 whitespace-nowrap ${(infantCount + childrenCount) > 0 ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
            onClick={() => toggleOverlay('children')}
          >
            {formatChildrenCount()}
          </div>
          
          <Link
            href={buildSearchUrl()}
            onClick={closeAllOverlays}
          >
            <MagnifyingGlassIcon className="h-8 w-8 bg-rose-500 text-white rounded-full p-2 ml-2 cursor-pointer hover:bg-rose-600 transition" />
          </Link>
        </div>

        {/* Filters Button - Desktop only */}
        <button
          onClick={() => toggleOverlay('filters')}
          className="hidden md:flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-full hover:shadow-md transition bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <AdjustmentsHorizontalIcon className="h-5 w-5" />
          <span className="text-sm font-medium">{t('header.filters')}</span>
        </button>

        {/* Mobile Search Bar - Compact */}
        <Link
          href={buildSearchUrl()}
          className="md:hidden flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-full py-2 px-4 shadow-sm active:shadow-md transition bg-white dark:bg-gray-800"
          onClick={closeAllOverlays}
        >
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {location || t('header.searchPlaceholder')}
          </span>
        </Link>
      </div>



      {/* Right */}
      <div className="flex items-center space-x-3 justify-end text-gray-500 dark:text-gray-400">
          {!isAuthenticated && (
            <button
              onClick={() => handleSignupClick('parent')}
              className="hidden md:inline-flex cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition"
            >
              {t('common.signUp')}
            </button>
          )}
          <ThemeToggle />
          <LanguageSwitcher />

        <div
          className="flex items-center space-x-2 border-2 p-1 rounded-full cursor-pointer hover:shadow-md transition relative"
          onClick={() => {
            const isOpening = activeOverlay !== 'userMenu';
            toggleOverlay('userMenu');
            if (isOpening) {
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
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
                  className="w-full h-full object-cover rounded-full"
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
      {activeOverlay === 'dates' && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl z-40 w-fit transition-colors duration-200">
          <Calendar onDateSelect={handleDateSelect} />
        </div>
      )}

      {/* Children Count Dropdown */}
      {activeOverlay === 'children' && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-2xl shadow-xl dark:shadow-2xl border border-gray-100 dark:border-gray-700 p-6 z-40 w-96 transition-colors duration-200">
          <div className="space-y-6">
            <div className="text-center border-b border-gray-100 dark:border-gray-700 pb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">👶 {t('header.howManyChildren')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('header.selectChildrenCount')}</p>
            </div>
            
            <div className="flex justify-between items-center p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                  🍼 <span className="ml-2">{t('header.infants')}</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 ml-6">{t('header.infantsAge')}</p>
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
                  🧒 <span className="ml-2">{t('header.children')}</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 ml-6">{t('header.childrenAge')}</p>
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
      {activeOverlay === 'filters' && (
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
                  onClick={closeAllOverlays}
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
              
              {/* Provider Type */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                  <span className="text-lg">👤</span>
                  <span>Provider Type</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "All", value: "all" },
                    { label: "Caregivers", value: "caregivers" },
                    { label: "Babysitters", value: "babysitters" }
                  ].map((option) => (
                    <label key={option.value} className="relative cursor-pointer group">
                      <input
                        type="radio"
                        name="providerType"
                        value={option.value}
                        className="sr-only peer"
                        checked={currentFilters.providerType === option.value}
                        onChange={(e) => updateFilters({ ...currentFilters, providerType: e.target.value })}
                      />
                      <div className={`p-3 rounded-xl border-2 transition-all duration-200 text-center
                        peer-checked:border-rose-500 peer-checked:bg-rose-50 dark:peer-checked:bg-rose-900/20
                        border-gray-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-600
                        group-hover:shadow-md`}>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {option.label}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

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
                      providerType: 'all',
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
                    closeAllOverlays();
                  }}
                  className="flex-1 py-3 px-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-red-300 dark:hover:border-red-600 transition-all duration-200"
                >
                  Clear All
                </button>
                <button
                  onClick={closeAllOverlays}
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
      {activeOverlay === 'location' && (
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
              
              {isLoadingSuggestions && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-rose-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </div>
                </div>
              )}
              
              {!isLoadingSuggestions && filteredSuggestions.length > 0 ? (
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
              ) : !isLoadingSuggestions && location.length > 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-600">
                  <div className="text-4xl mb-3">🤔</div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">No matches found for "{location}"</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Try searching for a Canadian city or province</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">Popular Destinations</h4>
                  <div className="grid grid-cols-1 gap-2 max-h-52 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                    {["Toronto, ON", "Montreal, QC", "Vancouver, BC", "Calgary, AB", "Ottawa, ON", "Edmonton, AB", "Winnipeg, MB", "Quebec City, QC"].map((popularLocation, index) => (
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
      {activeOverlay === 'userMenu' && (
        <div className="absolute top-2 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border dark:border-gray-700 py-3 z-40 w-80 transition-colors duration-200 backdrop-blur-sm">
          {!isAuthenticated ? (
            <>
              <div className="px-5 py-3 border-b dark:border-gray-700">
                <div className="text-center">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{t('userMenu.welcomeTitle')}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t('userMenu.welcomeSubtitle')}</p>
                </div>
              </div>
              
              <div className="p-4 space-y-3">
                <button
                  onClick={() => handleLoginClick('parent')}
                  className="w-full p-4 text-left hover:bg-gradient-to-r hover:from-teal-50 hover:to-cyan-50 dark:hover:from-teal-900/20 dark:hover:to-cyan-900/20 transition-all duration-200 rounded-xl border-2 border-transparent hover:border-teal-200 dark:hover:border-teal-700 group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/40 dark:to-cyan-900/40 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="text-2xl">👨‍👩‍👧‍👦</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">{t('userMenu.imAParent')}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{t('userMenu.parentDescription')}</div>
                      <div className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-1">{t('userMenu.parentAction')}</div>
                    </div>
                    <div className="text-teal-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => handleLoginClick('caregiver')}
                  className="w-full p-4 text-left hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 dark:hover:from-amber-900/20 dark:hover:to-orange-900/20 transition-all duration-200 rounded-xl border-2 border-transparent hover:border-amber-200 dark:hover:border-amber-700 group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/40 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="text-2xl">👩‍🏫</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">{t('userMenu.imACaregiver')}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{t('userMenu.caregiverDescription')}</div>
                      <div className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">{t('userMenu.caregiverAction')}</div>
                    </div>
                    <div className="text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleLoginClick('babysitter')}
                  className="w-full p-4 text-left hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-900/20 dark:hover:to-pink-900/20 transition-all duration-200 rounded-xl border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-700 group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <span className="text-2xl">👶</span>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-base">I&apos;m a Babysitter</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">Casual childcare provider</div>
                      <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mt-1">Sign in to your dashboard →</div>
                    </div>
                    <div className="text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </button>
              </div>

              <div className="px-5 py-3 border-t dark:border-gray-700">
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  {t('userMenu.newToInstaCares')}
                  <button
                    onClick={() => handleSignupClick('parent')}
                    className="ml-1 text-rose-600 dark:text-rose-400 font-medium hover:underline"
                  >
                    {t('userMenu.createAccount')}
                  </button>
                </p>
              </div>
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
                        className="w-full h-full object-cover rounded-full"
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

              {/* Role Switcher for Dual-Role Users */}
              {hasDualRole && (
                <div className="px-4 py-3 border-b dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">
                    Switch Role
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        switchRole('PARENT');
                        closeAllOverlays();
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
                        ${user?.activeRole === 'PARENT'
                          ? 'bg-teal-500 text-white shadow-md'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-teal-300 dark:hover:border-teal-600'
                        }`}
                    >
                      <span>👨‍👩‍👧</span>
                      <span>Parent</span>
                    </button>
                    <button
                      onClick={() => {
                        switchRole('CAREGIVER');
                        closeAllOverlays();
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2
                        ${user?.activeRole === 'CAREGIVER'
                          ? 'bg-amber-500 text-white shadow-md'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:border-amber-300 dark:hover:border-amber-600'
                        }`}
                    >
                      <span>👩‍🏫</span>
                      <span>Caregiver</span>
                    </button>
                  </div>
                </div>
              )}

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

              {/* Become a Caregiver option for parent-only users */}
              {user?.hasParentRole && !user?.hasCaregiverRole && (
                <button
                  onClick={() => {
                    setShowAddCaregiverModal(true);
                    closeAllOverlays();
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 dark:hover:from-amber-900/20 dark:hover:to-orange-900/20 transition group"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">👩‍🏫</span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Become a Caregiver</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 mt-0.5">Earn money helping families</p>
                </button>
              )}

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
      {activeOverlay !== null && (
        <div
          className="fixed inset-0 z-30 bg-black/10 backdrop-blur-sm"
          onClick={closeAllOverlays}
        />
      )}
    </div>

    {/* Signup Modal */}
    <SignupModal
      isOpen={showSignupModal}
      onClose={() => setShowSignupModal(false)}
      initialUserType={signupUserType}
    />
    
    {/* Login Modal */}
    <LoginModal
      isOpen={showLoginModal}
      onClose={() => setShowLoginModal(false)}
      userType={loginUserType}
    />

    {/* OAuth Profile Completion - uses SignupModal in oauthCompletion mode */}
    {showOAuthCompletionModal && user && (
      <SignupModal
        isOpen={showOAuthCompletionModal}
        onClose={() => setShowOAuthCompletionModal(false)}
        mode="oauthCompletion"
        oauthUserData={{
          email: user.email || '',
          firstName: user.profile?.firstName || user.name?.split(' ')[0] || '',
          lastName: user.profile?.lastName || user.name?.split(' ').slice(1).join(' ') || '',
          image: user.profile?.avatar || undefined
        }}
        onOAuthComplete={async () => {
          // Mark profile as completed in this session to prevent modal from reopening
          setProfileCompletedInSession(true);
          setShowOAuthCompletionModal(false);
          // Refresh user data to update needsProfileCompletion status
          await refreshUser();
        }}
      />
    )}

    {/* Add Caregiver Role Modal - for existing parents to become caregivers */}
    <AddCaregiverRoleModal
      isOpen={showAddCaregiverModal}
      onClose={() => setShowAddCaregiverModal(false)}
    />
    </>
  );
}

export default Header;
export type { FilterState };