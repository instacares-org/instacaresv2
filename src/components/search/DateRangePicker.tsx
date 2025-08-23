"use client";

import React, { useState } from 'react';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import Calendar from '../Calendar';
import { cn } from '../../lib/utils';

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onChange: (startDate: Date | null, endDate: Date | null) => void;
  placeholder?: string;
  className?: string;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  placeholder = "Any week",
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatDateRange = () => {
    if (startDate && endDate) {
      const startStr = startDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      const endStr = endDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
      return `${startStr} - ${endStr}`;
    }
    return placeholder;
  };

  const handleDateSelect = (start: Date | null, end: Date | null) => {
    onChange(start, end);
    if (start && end) {
      setIsOpen(false);
    }
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
    // Don't close if clicking inside calendar
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
          "flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 transition-colors",
          startDate && endDate && "text-gray-900"
        )}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label="Select date range"
      >
        <CalendarDaysIcon className="h-4 w-4" />
        <span>{formatDateRange()}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Calendar dropdown */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white rounded-2xl shadow-xl z-40 border border-gray-200">
            <Calendar onDateSelect={handleDateSelect} />
          </div>
        </>
      )}
    </div>
  );
};

export default DateRangePicker;