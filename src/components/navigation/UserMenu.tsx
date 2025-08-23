"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Bars3BottomLeftIcon, 
  UserCircleIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

interface UserProfile {
  name: string;
  image: string;
}

interface UserMenuProps {
  isLoggedIn: boolean;
  userType: 'parent' | 'caregiver' | null;
  userProfile: UserProfile | null;
  onLogin: (type: 'parent' | 'caregiver') => void;
  onLogout: () => void;
  className?: string;
}

const UserMenu: React.FC<UserMenuProps> = ({
  isLoggedIn,
  userType,
  userProfile,
  onLogin,
  onLogout,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleMenuToggle = () => setIsOpen(!isOpen);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleMenuToggle();
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking inside menu
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setTimeout(() => setIsOpen(false), 100);
  };

  const closeMenu = () => setIsOpen(false);

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={handleMenuToggle}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="flex items-center space-x-2 border-2 border-gray-200 p-1 rounded-full cursor-pointer hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="User menu"
      >
        <Bars3BottomLeftIcon className="h-5 w-5 text-gray-600" />
        {isLoggedIn && userProfile ? (
          <div className="w-7 h-7 rounded-full overflow-hidden">
            <img 
              src={userProfile.image} 
              alt={userProfile.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
              }}
            />
            <UserCircleIcon className="h-7 w-7 text-gray-400 hidden" />
          </div>
        ) : (
          <UserCircleIcon className="h-7 w-7 text-gray-400" />
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-30" 
            onClick={closeMenu}
            aria-hidden="true"
          />
          
          {/* Menu dropdown */}
          <div 
            className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-40 w-64"
            role="menu"
            aria-orientation="vertical"
          >
            {!isLoggedIn ? (
              <>
                <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                  Choose your login type
                </div>
                
                <Link
                  href="/login/parent"
                  role="menuitem"
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3 focus:bg-gray-50 focus:outline-none"
                  onClick={closeMenu}
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <UserCircleIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Parent Login</div>
                    <div className="text-xs text-gray-500">Looking for childcare</div>
                  </div>
                </Link>
                
                <Link
                  href="/login/caregiver"
                  role="menuitem"
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3 focus:bg-gray-50 focus:outline-none"
                  onClick={closeMenu}
                >
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <UserCircleIcon className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Caregiver Login</div>
                    <div className="text-xs text-gray-500">Offering childcare services</div>
                  </div>
                </Link>
              </>
            ) : (
              <>
                {/* User Profile Section */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden">
                      <img 
                        src={userProfile!.image} 
                        alt={userProfile!.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                        }}
                      />
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hidden">
                        <UserCircleIcon className="h-6 w-6 text-gray-400" />
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{userProfile!.name}</div>
                      <div className="text-xs text-gray-500 capitalize">{userType} account</div>
                    </div>
                  </div>
                </div>
                
                {/* Menu Items */}
                <Link 
                  href={userType === 'parent' ? '/parent-dashboard' : '/caregiver-dashboard'} 
                  role="menuitem"
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors focus:bg-gray-50 focus:outline-none"
                  onClick={closeMenu}
                >
                  <Cog6ToothIcon className="h-4 w-4 mr-3" />
                  Dashboard
                </Link>
                
                <Link 
                  href="/bookings" 
                  role="menuitem"
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors focus:bg-gray-50 focus:outline-none"
                  onClick={closeMenu}
                >
                  <CalendarDaysIcon className="h-4 w-4 mr-3" />
                  My Bookings
                </Link>
                
                <Link 
                  href="/settings" 
                  role="menuitem"
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors focus:bg-gray-50 focus:outline-none"
                  onClick={closeMenu}
                >
                  <Cog6ToothIcon className="h-4 w-4 mr-3" />
                  Settings
                </Link>
                
                <div className="border-t border-gray-100 mt-2">
                  <button
                    onClick={() => {
                      onLogout();
                      closeMenu();
                    }}
                    role="menuitem"
                    className="w-full flex items-center px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors focus:bg-red-50 focus:outline-none"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default UserMenu;