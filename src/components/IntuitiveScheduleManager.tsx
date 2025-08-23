"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  PlusIcon, 
  CheckIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  Bars3Icon,
  StarIcon
} from '@heroicons/react/24/outline';
import { useAvailability } from '@/hooks/useAvailability';

interface TimeSlot {
  id?: string;
  date: string;
  startTime: string;
  endTime: string;
  totalCapacity: number;
  baseRate: number;
  isRecurring: boolean;
  notes?: string;
  status?: string;
  currentOccupancy?: number;
  availableSpots?: number;
}

interface IntuitiveScheduleManagerProps {
  caregiverId: string;
  defaultCapacity?: number;
  defaultRate?: number;
}

// Predefined quick schedule templates
const QUICK_TEMPLATES = [
  {
    name: "Morning Hours",
    icon: "🌅",
    time: { start: "08:00", end: "12:00" },
    description: "8 AM - 12 PM"
  },
  {
    name: "Afternoon Hours", 
    icon: "☀️",
    time: { start: "13:00", end: "17:00" },
    description: "1 PM - 5 PM"
  },
  {
    name: "Full Day",
    icon: "🌍",
    time: { start: "08:00", end: "18:00" },
    description: "8 AM - 6 PM"
  },
  {
    name: "Evening Hours",
    icon: "🌆", 
    time: { start: "17:00", end: "21:00" },
    description: "5 PM - 9 PM"
  }
];

const DAYS_OF_WEEK = [
  { short: 'Sun', full: 'Sunday' },
  { short: 'Mon', full: 'Monday' },
  { short: 'Tue', full: 'Tuesday' },
  { short: 'Wed', full: 'Wednesday' },
  { short: 'Thu', full: 'Thursday' },
  { short: 'Fri', full: 'Friday' },
  { short: 'Sat', full: 'Saturday' }
];

export default function IntuitiveScheduleManager({ 
  caregiverId, 
  defaultCapacity = 4, 
  defaultRate = 25 
}: IntuitiveScheduleManagerProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [quickAddData, setQuickAddData] = useState({
    template: QUICK_TEMPLATES[0],
    capacity: defaultCapacity,
    rate: defaultRate,
    recurring: false
  });

  const { getAvailableSlots, createSlot, updateSlot, deleteSlot, error } = useAvailability();

  // Load existing slots
  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      const startOfWeek = new Date(selectedWeek);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const availableSlots = await getAvailableSlots({
        caregiverId,
        startDate: startOfWeek.toISOString(),
        endDate: endOfWeek.toISOString()
      });

      setSlots(availableSlots || []);
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setLoading(false);
    }
  }, [caregiverId, selectedWeek, getAvailableSlots]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // Navigation functions
  const goToPreviousWeek = () => {
    const newWeek = new Date(selectedWeek);
    newWeek.setDate(newWeek.getDate() - 7);
    setSelectedWeek(newWeek);
  };

  const goToNextWeek = () => {
    const newWeek = new Date(selectedWeek);
    newWeek.setDate(newWeek.getDate() + 7);
    setSelectedWeek(newWeek);
  };

  const goToThisWeek = () => {
    setSelectedWeek(new Date());
  };

  // Get week dates
  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(selectedWeek);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  // Handle quick add
  const handleQuickAdd = async () => {
    if (selectedDays.length === 0) {
      alert('Please select at least one day');
      return;
    }

    try {
      for (const dayIndex of selectedDays) {
        const date = weekDates[dayIndex];
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
        const slotData = {
          date: dateString,
          startTime: `${dateString}T${quickAddData.template.time.start}:00`,
          endTime: `${dateString}T${quickAddData.template.time.end}:00`,
          totalCapacity: quickAddData.capacity,
          baseRate: quickAddData.rate,
          isRecurring: quickAddData.recurring,
          notes: `${quickAddData.template.name} availability`
        };

        console.log('Creating slot with data:', slotData);
        const result = await createSlot(slotData);
        console.log('Slot created successfully:', result);
      }

      await loadSlots();
      setShowQuickAdd(false);
      setSelectedDays([]);
    } catch (err) {
      console.error('Failed to create slots:', err);
      
      // More detailed error logging
      if (err instanceof Error) {
        console.error('Error message:', err.message);
        console.error('Error stack:', err.stack);
      }
      
      alert(`Failed to create availability: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Handle day selection for quick add
  const toggleDaySelection = (dayIndex: number) => {
    setSelectedDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  // Quick actions for existing slots
  const handleSlotAction = async (slot: TimeSlot, action: 'duplicate' | 'delete') => {
    if (action === 'delete') {
      if (slot.currentOccupancy && slot.currentOccupancy > 0) {
        alert('Cannot delete a slot with existing bookings');
        return;
      }
      
      if (confirm('Delete this time slot?')) {
        try {
          await deleteSlot(slot.id!);
          await loadSlots();
        } catch (err) {
          alert(`Failed to delete slot: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    } else if (action === 'duplicate') {
      // Find next available day to duplicate to
      const currentDate = new Date(slot.date);
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      try {
        const duplicateData = {
          date: nextDay.toISOString().split('T')[0],
          startTime: slot.startTime,
          endTime: slot.endTime,
          totalCapacity: slot.totalCapacity,
          baseRate: slot.baseRate,
          isRecurring: false,
          notes: slot.notes + ' (duplicated)'
        };
        
        await createSlot(duplicateData);
        await loadSlots();
      } catch (err) {
        alert(`Failed to duplicate slot: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
  };

  const formatTime = (timeString: string) => {
    try {
      return new Date(timeString).toLocaleTimeString([], { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return 'Invalid time';
    }
  };

  const getSlotColor = (slot: TimeSlot) => {
    if (slot.currentOccupancy === slot.totalCapacity) {
      return 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300';
    }
    if ((slot.currentOccupancy || 0) > 0) {
      return 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300';
    }
    return 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300';
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading your schedule...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Your Schedule</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your availability with ease
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowQuickAdd(true)}
            className="bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl hover:from-green-600 hover:to-green-700 transition-all shadow-lg hover:shadow-xl flex items-center font-medium"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Quick Add
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousWeek}
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
          
          <div className="flex items-center space-x-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              {weekDates[0].toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - 
              {weekDates[6].toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </h4>
            <button
              onClick={goToThisWeek}
              className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              This Week
            </button>
          </div>
          
          <button
            onClick={goToNextWeek}
            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <ArrowRightIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Weekly Calendar Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700">
          {weekDates.map((date, dayIndex) => {
            const daySlots = slots.filter(slot => {
              const slotDate = new Date(slot.date);
              return slotDate.toDateString() === date.toDateString();
            });
            
            const isToday = date.toDateString() === new Date().toDateString();
            const isPast = date < new Date() && !isToday;
            
            return (
              <div key={date.toISOString()} className="min-h-[400px] flex flex-col">
                {/* Day Header */}
                <div className={`p-4 text-center border-b border-gray-200 dark:border-gray-700 ${
                  isToday ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20' : 
                  isPast ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-gray-50 dark:bg-gray-800/30'
                }`}>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    {DAYS_OF_WEEK[dayIndex].short}
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${
                    isToday ? 'text-blue-600 dark:text-blue-400' : 
                    isPast ? 'text-gray-400 dark:text-gray-500' :
                    'text-gray-900 dark:text-white'
                  }`}>
                    {date.getDate()}
                  </div>
                  {daySlots.length > 0 && (
                    <div className="mt-2">
                      <span className="inline-block px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                        {daySlots.length} slot{daySlots.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Day Content */}
                <div className="flex-1 p-3 space-y-2">
                  {daySlots.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-center">
                      <div className="text-gray-400 dark:text-gray-500">
                        <ClockIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No availability</p>
                        <p className="text-xs">Click Quick Add to set hours</p>
                      </div>
                    </div>
                  ) : (
                    daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`relative rounded-lg p-3 border-2 transition-all hover:shadow-md cursor-pointer group ${getSlotColor(slot)}`}
                      >
                        {/* Slot Info */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm">
                              {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                            </div>
                            <div className="text-xs font-medium">
                              {slot.availableSpots}/{slot.totalCapacity}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs">
                            <span>${slot.baseRate}/hr</span>
                            {(slot.currentOccupancy || 0) > 0 && (
                              <span className="bg-white/70 dark:bg-gray-800/70 px-2 py-1 rounded">
                                {slot.currentOccupancy} booked
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick Actions (appear on hover) */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSlotAction(slot, 'duplicate');
                              }}
                              className="p-1 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 rounded shadow text-xs"
                              title="Duplicate to tomorrow"
                            >
                              📋
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSlotAction(slot, 'delete');
                              }}
                              className="p-1 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 rounded shadow text-xs text-red-600"
                              title="Delete slot"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Quick Add Availability</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Set your hours in seconds</p>
              </div>
              <button
                onClick={() => setShowQuickAdd(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Step 1: Choose Template */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">1. Choose Your Hours</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {QUICK_TEMPLATES.map((template, index) => (
                    <button
                      key={index}
                      onClick={() => setQuickAddData({...quickAddData, template})}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        quickAddData.template.name === template.name
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="text-2xl mb-2">{template.icon}</div>
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{template.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Select Days */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">2. Select Days</h4>
                <div className="grid grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((day, index) => (
                    <button
                      key={index}
                      onClick={() => toggleDaySelection(index)}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${
                        selectedDays.includes(index)
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <div className="text-sm font-medium">{day.short}</div>
                      <div className="text-xs mt-1">{weekDates[index].getDate()}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedDays([1, 2, 3, 4, 5])} // Mon-Fri
                    className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  >
                    Weekdays
                  </button>
                  <button
                    onClick={() => setSelectedDays([0, 6])} // Sat-Sun
                    className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-3 py-1 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50"
                  >
                    Weekends
                  </button>
                  <button
                    onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])} // All days
                    className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-3 py-1 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50"
                  >
                    All Week
                  </button>
                </div>
              </div>

              {/* Step 3: Settings */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">3. Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Available Spots
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={quickAddData.capacity}
                      onChange={(e) => setQuickAddData({...quickAddData, capacity: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Hourly Rate ($)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="200"
                      step="5"
                      value={quickAddData.rate}
                      onChange={(e) => setQuickAddData({...quickAddData, rate: parseFloat(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowQuickAdd(false)}
                  className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuickAdd}
                  disabled={selectedDays.length === 0}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckIcon className="h-4 w-4 inline mr-2" />
                  Add Availability
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
          <div className="flex items-center">
            <CalendarDaysIcon className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
            <div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{slots.length}</div>
              <div className="text-sm text-blue-600 dark:text-blue-300">Total Slots This Week</div>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
          <div className="flex items-center">
            <StarIcon className="h-8 w-8 text-green-600 dark:text-green-400 mr-3" />
            <div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {slots.reduce((sum, slot) => sum + (slot.availableSpots || 0), 0)}
              </div>
              <div className="text-sm text-green-600 dark:text-green-300">Available Spots</div>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
          <div className="flex items-center">
            <ClockIcon className="h-8 w-8 text-purple-600 dark:text-purple-400 mr-3" />
            <div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                ${slots.reduce((sum, slot) => sum + slot.baseRate, 0) / (slots.length || 1)}
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-300">Avg. Hourly Rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}