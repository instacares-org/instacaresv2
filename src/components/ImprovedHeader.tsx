"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { GlobeAltIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import LocationSearch from './search/LocationSearch';
import DateRangePicker from './search/DateRangePicker';
import ChildrenCounter from './search/ChildrenCounter';
import UserMenu from './navigation/UserMenu';
import { cn } from '../lib/utils';

interface ImprovedHeaderProps {
  className?: string;
}

const ImprovedHeader: React.FC<ImprovedHeaderProps> = ({ className }) => {
  // Search state
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [infantCount, setInfantCount] = useState(0);
  const [childrenCount, setChildrenCount] = useState(0);

  // User state - in a real app, this would come from auth context
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userType, setUserType] = useState<'parent' | 'caregiver' | null>(null);
  const [userProfile, setUserProfile] = useState<{name: string, image: string} | null>(null);

  const handleLocationSelect = (selectedLocation: string) => {
    setLocation(selectedLocation);
  };

  const handleDateChange = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleChildrenChange = (infants: number, children: number) => {
    setInfantCount(infants);
    setChildrenCount(children);
  };

  const handleLogin = (type: 'parent' | 'caregiver') => {
    setIsLoggedIn(true);
    setUserType(type);
    
    // Mock user profiles
    const profiles = {
      parent: {
        name: "John Smith",
        image: "/users/parent-1.jpg"
      },
      caregiver: {
        name: "Sarah Johnson", 
        image: "/caregivers/default.svg"
      }
    };
    
    setUserProfile(profiles[type]);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserType(null);
    setUserProfile(null);
  };

  const buildSearchUrl = () => {
    const params = new URLSearchParams();
    
    if (location) params.set('location', location);
    if (startDate) params.set('startDate', startDate.toISOString());
    if (endDate) params.set('endDate', endDate.toISOString());
    if (infantCount > 0) params.set('infants', infantCount.toString());
    if (childrenCount > 0) params.set('children', childrenCount.toString());
    
    const queryString = params.toString();
    return `/search${queryString ? `?${queryString}` : ''}`;
  };

  return (
    <header className={cn("sticky top-0 z-50 bg-white shadow-md", className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 items-center py-3">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="block h-15 w-24">
              <Image
                src="/logo.png"
                width={96}
                height={60}
                alt="Instacares Logo"
                className="object-contain w-full h-auto"
                priority
              />
            </Link>
          </div>

          {/* Search Bar */}
          <div className="flex items-center justify-center">
            <div className="hidden md:flex items-center border border-gray-300 rounded-full py-2 px-4 shadow-sm hover:shadow-md transition-shadow max-w-2xl w-full">
              
              {/* Location Search */}
              <div className="flex-1 min-w-0">
                <LocationSearch
                  value={location}
                  onChange={setLocation}
                  onSelect={handleLocationSelect}
                  placeholder="Where in Canada?"
                  className="border-none"
                />
              </div>
              
              <div className="border-l border-gray-300 h-6 mx-2" aria-hidden="true" />
              
              {/* Date Range */}
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={handleDateChange}
              />
              
              <div className="border-l border-gray-300 h-6 mx-2" aria-hidden="true" />
              
              {/* Children Counter */}
              <ChildrenCounter
                infantCount={infantCount}
                childrenCount={childrenCount}
                onChange={handleChildrenChange}
              />

              {/* Search Button */}
              <Link 
                href={buildSearchUrl()}
                className="ml-2 p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-colors"
                aria-label="Search for childcare"
              >
                <MagnifyingGlassIcon className="h-4 w-4" />
              </Link>
            </div>

            {/* Mobile Search Button */}
            <Link 
              href="/search"
              className="md:hidden flex items-center justify-center w-10 h-10 bg-rose-500 text-white rounded-full hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 transition-colors"
              aria-label="Search for childcare"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </Link>
          </div>

          {/* Right Side Navigation */}
          <div className="flex items-center space-x-4 justify-end">
            <Link 
              href="/signup" 
              className="hidden md:inline-flex text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-md px-2 py-1"
            >
              Sign Up
            </Link>
            
            <button
              className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-500 rounded-md transition-colors"
              aria-label="Change language"
            >
              <GlobeAltIcon className="h-5 w-5" />
            </button>

            <UserMenu
              isLoggedIn={isLoggedIn}
              userType={userType}
              userProfile={userProfile}
              onLogin={handleLogin}
              onLogout={handleLogout}
            />
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden pb-3">
          <div className="flex items-center border border-gray-300 rounded-lg py-2 px-3 bg-gray-50">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 mr-3" />
            <Link 
              href="/search"
              className="flex-1 text-gray-500 text-sm focus:outline-none"
            >
              Search for childcare across Canada...
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default ImprovedHeader;