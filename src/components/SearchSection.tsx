"use client";

import { MagnifyingGlassIcon, CalendarDaysIcon, UserGroupIcon, AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import Calendar from "./Calendar";

function SearchSection() {
  const [activeField, setActiveField] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const handleDateSelect = (start: Date | null, end: Date | null) => {
    setStartDate(start);
    setEndDate(end);
    if (start && end) {
      setActiveField(null); // Close calendar when both dates selected
    }
  };

  const formatDateRange = () => {
    if (startDate && endDate) {
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    if (startDate) {
      return startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return "Add dates";
  };

  return (
    <div className="relative -mt-16 mx-auto max-w-4xl px-4">
      <div className="bg-white rounded-2xl shadow-lg p-2">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          
          {/* Location */}
          <div 
            className={`p-4 rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${
              activeField === 'location' ? 'bg-white shadow-md' : ''
            }`}
            onClick={() => setActiveField('location')}
          >
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Where
            </label>
            <input 
              type="text" 
              placeholder="Search Canadian location" 
              className="w-full text-sm text-gray-600 bg-transparent border-none outline-none mt-1 placeholder-gray-400"
            />
          </div>

          {/* Date Range */}
          <div 
            className={`p-4 rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${
              activeField === 'dates' ? 'bg-white shadow-md' : ''
            }`}
            onClick={() => setActiveField('dates')}
          >
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              When
            </label>
            <div className="flex items-center mt-1">
              <CalendarDaysIcon className="h-4 w-4 text-gray-400 mr-2" />
              <span className={`text-sm ${startDate && endDate ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                {formatDateRange()}
              </span>
            </div>
          </div>

          {/* Children Count */}
          <div 
            className={`p-4 rounded-xl cursor-pointer transition-all hover:bg-gray-50 ${
              activeField === 'children' ? 'bg-white shadow-md' : ''
            }`}
            onClick={() => setActiveField('children')}
          >
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Children
            </label>
            <div className="flex items-center mt-1">
              <UserGroupIcon className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-sm text-gray-600">Add children</span>
            </div>
          </div>

          {/* Search Button & Filter */}
          <div className="flex items-center justify-center p-2 space-x-2">
            <button className="bg-rose-500 hover:bg-rose-600 text-white rounded-full p-4 transition-colors shadow-lg hover:shadow-xl">
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
            <button 
              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 transition-colors shadow-lg"
              onClick={() => {
                // Add filter functionality here
                console.log('Filter clicked!');
                alert('Filter clicked!');
              }}
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
            </button>
          </div>

        </div>
      </div>

      {/* Expanded Date Picker (shown when dates are active) */}
      {activeField === 'dates' && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl z-50">
          <Calendar onDateSelect={handleDateSelect} />
        </div>
      )}

      {/* Expanded Children Selector */}
      {activeField === 'children' && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl p-6 z-50">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900">Infants</p>
                <p className="text-sm text-gray-500">Under 2 years</p>
              </div>
              <div className="flex items-center space-x-3">
                <button className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-900">
                  −
                </button>
                <span className="w-8 text-center">0</span>
                <button className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-900">
                  +
                </button>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-gray-900">Children</p>
                <p className="text-sm text-gray-500">Ages 2-12</p>
              </div>
              <div className="flex items-center space-x-3">
                <button className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-900">
                  −
                </button>
                <span className="w-8 text-center">0</span>
                <button className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:border-gray-900">
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay to close expanded sections */}
      {activeField && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setActiveField(null)}
        />
      )}
    </div>
  );
}

export default SearchSection;