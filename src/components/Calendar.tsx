"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

interface CalendarProps {
  onDateSelect?: (startDate: Date | null, endDate: Date | null) => void;
}

function Calendar({ onDateSelect }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  const [isSelectingEndDate, setIsSelectingEndDate] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const handleDateClick = (date: Date) => {
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      // Start new selection
      setSelectedStartDate(date);
      setSelectedEndDate(null);
      setIsSelectingEndDate(true);
    } else if (isSelectingEndDate) {
      // Select end date
      if (date < selectedStartDate) {
        // If clicked date is before start date, make it the new start date
        setSelectedStartDate(date);
        setSelectedEndDate(null);
      } else {
        setSelectedEndDate(date);
        setIsSelectingEndDate(false);
        onDateSelect?.(selectedStartDate, date);
      }
    }
  };

  const isDateInRange = (date: Date) => {
    if (!selectedStartDate) return false;
    if (!selectedEndDate) return false;
    return date >= selectedStartDate && date <= selectedEndDate;
  };

  const isDateSelected = (date: Date) => {
    return (selectedStartDate && date.getTime() === selectedStartDate.getTime()) ||
           (selectedEndDate && date.getTime() === selectedEndDate.getTime());
  };

  const isStartDate = (date: Date) => {
    return selectedStartDate && date.getTime() === selectedStartDate.getTime();
  };

  const isEndDate = (date: Date) => {
    return selectedEndDate && date.getTime() === selectedEndDate.getTime();
  };

  const isMiddleDate = (date: Date) => {
    return isDateInRange(date) && !isDateSelected(date);
  };

  const isInHoverRange = (date: Date) => {
    if (!selectedStartDate || !hoveredDate || !isSelectingEndDate) return false;
    const start = selectedStartDate;
    const end = hoveredDate;
    return date >= start && date <= end && date !== start;
  };

  const isHoverEndDate = (date: Date) => {
    return hoveredDate && isSelectingEndDate && date.getTime() === hoveredDate.getTime();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(currentMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(currentMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const renderCalendar = (monthOffset: number = 0) => {
    const displayMonth = new Date(currentMonth);
    displayMonth.setMonth(currentMonth.getMonth() + monthOffset);
    const days = getDaysInMonth(displayMonth);

    return (
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {monthNames[displayMonth.getMonth()]} {displayMonth.getFullYear()}
          </h3>
          {monthOffset === 0 && (
            <div className="flex space-x-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayNames.map((day) => (
            <div key={day} className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((date, index) => (
            <div key={index} className="aspect-square relative">
              {date ? (
                <>
                  {/* Background highlighting for range */}
                  {isMiddleDate(date) && (
                    <div className="absolute inset-0 bg-rose-100 dark:bg-rose-900/40"></div>
                  )}
                  {isInHoverRange(date) && !isMiddleDate(date) && (
                    <div className="absolute inset-0 bg-rose-50 dark:bg-rose-900/20 opacity-75"></div>
                  )}
                  {isStartDate(date) && selectedEndDate && (
                    <div className="absolute inset-0 bg-rose-100 dark:bg-rose-900/40 rounded-l-lg"></div>
                  )}
                  {isEndDate(date) && (
                    <div className="absolute inset-0 bg-rose-100 dark:bg-rose-900/40 rounded-r-lg"></div>
                  )}
                  {isHoverEndDate(date) && !isEndDate(date) && (
                    <div className="absolute inset-0 bg-rose-200 dark:bg-rose-800/60 rounded-lg opacity-60"></div>
                  )}
                  
                  <button
                    onClick={() => !isPastDate(date) && handleDateClick(date)}
                    onMouseEnter={() => !isPastDate(date) && setHoveredDate(date)}
                    onMouseLeave={() => setHoveredDate(null)}
                    disabled={isPastDate(date)}
                    className={`
                      w-full h-full flex items-center justify-center text-sm font-medium transition-all duration-200 relative z-10
                      ${isPastDate(date) 
                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                        : 'hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer rounded-lg text-gray-700 dark:text-gray-300'
                      }
                      ${isStartDate(date) 
                        ? 'bg-rose-500 dark:bg-rose-600 text-white hover:bg-rose-600 dark:hover:bg-rose-700 rounded-lg shadow-lg scale-110' 
                        : ''
                      }
                      ${isEndDate(date) 
                        ? 'bg-rose-500 dark:bg-rose-600 text-white hover:bg-rose-600 dark:hover:bg-rose-700 rounded-lg shadow-lg scale-110' 
                        : ''
                      }
                      ${isHoverEndDate(date) && !isEndDate(date)
                        ? 'bg-rose-400 dark:bg-rose-500 text-white rounded-lg shadow-md scale-105' 
                        : ''
                      }
                      ${isMiddleDate(date) 
                        ? 'bg-transparent text-rose-700 dark:text-rose-300 font-semibold hover:bg-rose-200 dark:hover:bg-rose-800/40 hover:rounded-lg' 
                        : ''
                      }
                      ${isInHoverRange(date) && !isMiddleDate(date)
                        ? 'bg-transparent text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/30' 
                        : ''
                      }
                      ${isToday(date) && !isDateSelected(date) && !isHoverEndDate(date)
                        ? 'ring-2 ring-rose-400 dark:ring-rose-500 ring-opacity-60' 
                        : ''
                      }
                    `}
                  >
                    <span className={`${isDateSelected(date) || isHoverEndDate(date) ? 'font-bold' : ''}`}>
                      {date.getDate()}
                    </span>
                  </button>
                </>
              ) : (
                <div></div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6 text-center border-b border-gray-200 dark:border-gray-700 pb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center justify-center">
          📅 <span className="ml-2">When do you need childcare?</span>
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Click to select your start date, then click your end date. The full range will be highlighted.
        </p>
        {selectedStartDate && !selectedEndDate && (
          <p className="text-rose-600 dark:text-rose-400 text-sm mt-2 font-medium bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-lg inline-block">
            ✨ Now select your end date
          </p>
        )}
      </div>

      <div className="flex space-x-8">
        {renderCalendar(0)}
        {renderCalendar(1)}
      </div>

      <div className="flex justify-between items-center mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
          {selectedStartDate && selectedEndDate ? (
            <span className="font-medium text-gray-900 dark:text-gray-100">
              📅 {selectedStartDate.toLocaleDateString()} - {selectedEndDate.toLocaleDateString()}
            </span>
          ) : selectedStartDate ? (
            <span className="font-medium text-gray-900 dark:text-gray-100">
              📅 Start: {selectedStartDate.toLocaleDateString()}
            </span>
          ) : (
            <span>📅 Select dates</span>
          )}
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setSelectedStartDate(null);
              setSelectedEndDate(null);
              setIsSelectingEndDate(false);
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 transition-all duration-200"
          >
            Clear
          </button>
          <button
            onClick={() => onDateSelect?.(selectedStartDate, selectedEndDate)}
            disabled={!selectedStartDate || !selectedEndDate}
            className="px-6 py-2 text-sm font-medium bg-rose-500 hover:bg-rose-600 dark:bg-rose-600 dark:hover:bg-rose-700 text-white rounded-lg disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none"
          >
            {selectedStartDate && selectedEndDate ? '✅ Apply Dates' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Calendar;