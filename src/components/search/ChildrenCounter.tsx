"use client";

import React, { useState } from 'react';
import { UserGroupIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { cn } from '../../lib/utils';

interface ChildrenCounterProps {
  infantCount: number;
  childrenCount: number;
  onChange: (infantCount: number, childrenCount: number) => void;
  className?: string;
}

const ChildrenCounter: React.FC<ChildrenCounterProps> = ({
  infantCount,
  childrenCount,
  onChange,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const totalChildren = infantCount + childrenCount;

  const formatChildrenCount = () => {
    if (totalChildren === 0) return "Add children";
    if (totalChildren === 1) return "1 child";
    return `${totalChildren} children`;
  };

  const updateInfantCount = (count: number) => {
    const newCount = Math.max(0, Math.min(10, count));
    onChange(newCount, childrenCount);
  };

  const updateChildrenCount = (count: number) => {
    const newCount = Math.max(0, Math.min(10, count));
    onChange(infantCount, newCount);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(!isOpen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Don't close if clicking inside dropdown
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setTimeout(() => setIsOpen(false), 100);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className={cn(
          "flex items-center space-x-2 px-3 py-2 text-sm font-medium hover:bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors",
          totalChildren > 0 ? "text-gray-900" : "text-gray-500"
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Select number of children"
      >
        <UserGroupIcon className="h-4 w-4" />
        <span>{formatChildrenCount()}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Dropdown */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white rounded-2xl shadow-xl p-6 z-40 w-80 border border-gray-200">
            <div className="space-y-6">
              {/* Infants */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">Infants</p>
                  <p className="text-sm text-gray-500">Under 2 years</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => updateInfantCount(infantCount - 1)}
                    disabled={infantCount === 0}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors"
                    aria-label="Decrease infant count"
                  >
                    <MinusIcon className="h-3 w-3" />
                  </button>
                  <span 
                    className="w-8 text-center font-medium"
                    aria-label={`${infantCount} infants`}
                  >
                    {infantCount}
                  </span>
                  <button 
                    onClick={() => updateInfantCount(infantCount + 1)}
                    disabled={infantCount >= 10}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors"
                    aria-label="Increase infant count"
                  >
                    <PlusIcon className="h-3 w-3" />
                  </button>
                </div>
              </div>
              
              {/* Children */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">Children</p>
                  <p className="text-sm text-gray-500">Ages 2-12</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => updateChildrenCount(childrenCount - 1)}
                    disabled={childrenCount === 0}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors"
                    aria-label="Decrease children count"
                  >
                    <MinusIcon className="h-3 w-3" />
                  </button>
                  <span 
                    className="w-8 text-center font-medium"
                    aria-label={`${childrenCount} children`}
                  >
                    {childrenCount}
                  </span>
                  <button 
                    onClick={() => updateChildrenCount(childrenCount + 1)}
                    disabled={childrenCount >= 10}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors"
                    aria-label="Increase children count"
                  >
                    <PlusIcon className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Summary */}
              {totalChildren > 0 && (
                <div className="pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-600 text-center">
                    Total: <span className="font-medium text-gray-900">{formatChildrenCount()}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChildrenCounter;