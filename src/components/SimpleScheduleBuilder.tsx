"use client";

import { useState, useEffect } from 'react';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  PlusIcon, 
  CheckIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  DocumentDuplicateIcon,
  Squares2X2Icon,
  ListBulletIcon
} from '@heroicons/react/24/outline';
import { useAvailability } from '@/hooks/useAvailability';

interface SimpleScheduleBuilderProps {
  caregiverId: string;
  defaultCapacity?: number;
  defaultRate?: number;
  onScheduleUpdate?: (slots: any[]) => void;
}

interface ScheduleSlot {
  day: string;
  startTime: string;
  endTime: string;
  capacity: number;
  rate: number;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const COMMON_TIMES = [
  { label: '6:00 AM', value: '06:00' },
  { label: '7:00 AM', value: '07:00' },
  { label: '8:00 AM', value: '08:00' },
  { label: '9:00 AM', value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
  { label: '12:00 PM', value: '12:00' },
  { label: '1:00 PM', value: '13:00' },
  { label: '2:00 PM', value: '14:00' },
  { label: '3:00 PM', value: '15:00' },
  { label: '4:00 PM', value: '16:00' },
  { label: '5:00 PM', value: '17:00' },
  { label: '6:00 PM', value: '18:00' },
  { label: '7:00 PM', value: '19:00' },
  { label: '8:00 PM', value: '20:00' },
  { label: '9:00 PM', value: '21:00' },
];

const SCHEDULE_TEMPLATES = [
  {
    name: "Traditional Work Week",
    icon: "💼",
    description: "Monday to Friday, 9 AM - 5 PM",
    schedule: [
      { day: 'Monday', startTime: '09:00', endTime: '17:00' },
      { day: 'Tuesday', startTime: '09:00', endTime: '17:00' },
      { day: 'Wednesday', startTime: '09:00', endTime: '17:00' },
      { day: 'Thursday', startTime: '09:00', endTime: '17:00' },
      { day: 'Friday', startTime: '09:00', endTime: '17:00' },
    ]
  },
  {
    name: "Extended Weekdays",
    icon: "⏰",
    description: "Monday to Friday, 7 AM - 7 PM",
    schedule: [
      { day: 'Monday', startTime: '07:00', endTime: '19:00' },
      { day: 'Tuesday', startTime: '07:00', endTime: '19:00' },
      { day: 'Wednesday', startTime: '07:00', endTime: '19:00' },
      { day: 'Thursday', startTime: '07:00', endTime: '19:00' },
      { day: 'Friday', startTime: '07:00', endTime: '19:00' },
    ]
  },
  {
    name: "Weekend Specialist",
    icon: "🌅",
    description: "Saturday & Sunday, 8 AM - 6 PM",
    schedule: [
      { day: 'Saturday', startTime: '08:00', endTime: '18:00' },
      { day: 'Sunday', startTime: '08:00', endTime: '18:00' },
    ]
  },
  {
    name: "Full Week Coverage",
    icon: "🗓️",
    description: "All days, 8 AM - 6 PM",
    schedule: [
      { day: 'Monday', startTime: '08:00', endTime: '18:00' },
      { day: 'Tuesday', startTime: '08:00', endTime: '18:00' },
      { day: 'Wednesday', startTime: '08:00', endTime: '18:00' },
      { day: 'Thursday', startTime: '08:00', endTime: '18:00' },
      { day: 'Friday', startTime: '08:00', endTime: '18:00' },
      { day: 'Saturday', startTime: '08:00', endTime: '18:00' },
      { day: 'Sunday', startTime: '08:00', endTime: '18:00' },
    ]
  },
  {
    name: "Early Bird",
    icon: "🌄",
    description: "Weekdays, 6 AM - 2 PM",
    schedule: [
      { day: 'Monday', startTime: '06:00', endTime: '14:00' },
      { day: 'Tuesday', startTime: '06:00', endTime: '14:00' },
      { day: 'Wednesday', startTime: '06:00', endTime: '14:00' },
      { day: 'Thursday', startTime: '06:00', endTime: '14:00' },
      { day: 'Friday', startTime: '06:00', endTime: '14:00' },
    ]
  },
  {
    name: "Evening Care",
    icon: "🌙",
    description: "Weekdays, 3 PM - 9 PM",
    schedule: [
      { day: 'Monday', startTime: '15:00', endTime: '21:00' },
      { day: 'Tuesday', startTime: '15:00', endTime: '21:00' },
      { day: 'Wednesday', startTime: '15:00', endTime: '21:00' },
      { day: 'Thursday', startTime: '15:00', endTime: '21:00' },
      { day: 'Friday', startTime: '15:00', endTime: '21:00' },
    ]
  }
];

export default function SimpleScheduleBuilder({ 
  caregiverId, 
  defaultCapacity = 4, 
  defaultRate = 25,
  onScheduleUpdate
}: SimpleScheduleBuilderProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [globalSettings, setGlobalSettings] = useState({
    capacity: defaultCapacity,
    rate: defaultRate
  });
  const [showTemplates, setShowTemplates] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { createSlot, getAvailableSlots, deleteSlot, loading } = useAvailability();
  const [existingSlots, setExistingSlots] = useState<any[]>([]);

  // Get the dates for the current week
  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(currentWeek);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Start on Monday
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  // Load existing availability slots for the current week
  useEffect(() => {
    const loadExistingSlots = async () => {
      try {
        // Format dates in local timezone (YYYY-MM-DD)
        const startYear = weekDates[0].getFullYear();
        const startMonth = String(weekDates[0].getMonth() + 1).padStart(2, '0');
        const startDay = String(weekDates[0].getDate()).padStart(2, '0');
        const startDate = `${startYear}-${startMonth}-${startDay}`;
        
        const endYear = weekDates[6].getFullYear();
        const endMonth = String(weekDates[6].getMonth() + 1).padStart(2, '0');
        const endDay = String(weekDates[6].getDate()).padStart(2, '0');
        const endDate = `${endYear}-${endMonth}-${endDay}`;
        
        const slots = await getAvailableSlots({
          caregiverId,
          startDate,
          endDate
        });
        
        setExistingSlots(slots || []);
      } catch (error) {
        console.error('Failed to load existing slots:', error);
      }
    };

    if (caregiverId) {
      loadExistingSlots();
    }
  }, [currentWeek, caregiverId, getAvailableSlots]);

  // Apply template to schedule
  const applyTemplate = (template: any) => {
    const newSlots = template.schedule.map((slot: any) => ({
      ...slot,
      capacity: globalSettings.capacity,
      rate: globalSettings.rate
    }));
    setScheduleSlots(newSlots);
    setShowTemplates(false);
  };

  // Add or update a slot for a specific day
  const updateDaySlot = (day: string, startTime: string, endTime: string) => {
    setScheduleSlots(prev => {
      const filtered = prev.filter(slot => slot.day !== day);
      if (startTime && endTime) {
        return [...filtered, {
          day,
          startTime,
          endTime,
          capacity: globalSettings.capacity,
          rate: globalSettings.rate
        }];
      }
      return filtered;
    });
  };

  // Remove a day's slot
  const removeDaySlot = (day: string) => {
    setScheduleSlots(prev => prev.filter(slot => slot.day !== day));
  };

  // Copy schedule to next week
  const copyToNextWeek = () => {
    const nextWeek = new Date(currentWeek);
    nextWeek.setDate(nextWeek.getDate() + 7);
    setCurrentWeek(nextWeek);
  };

  // Submit schedule
  const submitSchedule = async () => {
    if (scheduleSlots.length === 0) {
      alert('Please add at least one time slot');
      return;
    }

    setIsSubmitting(true);
    const createdSlots = [];

    try {
      for (const slot of scheduleSlots) {
        const dayIndex = DAYS.indexOf(slot.day);
        const date = weekDates[dayIndex];
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        // Check if there's already an existing slot for this time
        const existingSlotsForDay = getExistingSlotsForDay(date);
        const startTimeToCheck = `${dateString}T${slot.startTime}:00`;
        
        const duplicateSlot = existingSlotsForDay.find(existingSlot => {
          const existingStartTime = new Date(existingSlot.startTime).toISOString();
          return existingStartTime === new Date(startTimeToCheck).toISOString();
        });

        if (duplicateSlot) {
          // Show user-friendly confirmation dialog instead of error
          const confirmReplace = window.confirm(
            `⚠️ Time Slot Already Exists\n\n` +
            `You already have a schedule for ${slot.day} at ${slot.startTime}.\n\n` +
            `Would you like to:\n` +
            `• Click "OK" to replace the existing slot\n` +
            `• Click "Cancel" to keep the existing slot and skip this time`
          );
          
          if (confirmReplace) {
            // Delete the existing slot first
            try {
              await deleteSlot(duplicateSlot.id);
              // Remove from local state to keep UI in sync
              setExistingSlots(prev => prev.filter(s => s.id !== duplicateSlot.id));
            } catch (deleteError) {
              alert(`❌ Failed to replace existing slot: ${deleteError.message}`);
              continue; // Skip this slot and continue with others
            }
          } else {
            // User chose to skip this slot
            continue; // Skip to next slot
          }
        }

        const createdSlot = await createSlot({
          date: dateString,
          startTime: startTimeToCheck,
          endTime: `${dateString}T${slot.endTime}:00`,
          totalCapacity: slot.capacity,
          baseRate: slot.rate,
          isRecurring: false,
          notes: `Weekly schedule for ${slot.day}`
        });
        
        createdSlots.push(createdSlot);
      }

      // Clear the schedule slots
      setScheduleSlots([]);
      
      // Update existing slots to include the newly created ones
      setExistingSlots(prev => [...prev, ...createdSlots]);
      
      // Show success message with details
      const totalSlots = scheduleSlots.length;
      const createdCount = createdSlots.length;
      const skippedCount = totalSlots - createdCount;
      
      let message = `✅ Schedule Update Complete!\n\n`;
      
      if (createdCount > 0) {
        message += `• Created ${createdCount} new time slot${createdCount === 1 ? '' : 's'}\n`;
      }
      
      if (skippedCount > 0) {
        message += `• Skipped ${skippedCount} existing time slot${skippedCount === 1 ? '' : 's'}\n`;
      }
      
      message += `\nYour availability is now live and visible to parents.`;
      
      alert(message);
      
      // Force refresh of any parent component availability data
      if (onScheduleUpdate) {
        onScheduleUpdate(createdSlots);
      }
      
    } catch (err) {
      console.error('Failed to create schedule:', err);
      alert('❌ Failed to create schedule. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeek(newWeek);
  };

  // Get existing slots for a specific day
  const getExistingSlotsForDay = (date: Date) => {
    // Format date as YYYY-MM-DD in local timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const targetDateStr = `${year}-${month}-${day}`;
    
    return existingSlots.filter(slot => {
      // Parse the slot date and extract YYYY-MM-DD
      const slotDate = new Date(slot.date);
      const slotYear = slotDate.getUTCFullYear();
      const slotMonth = String(slotDate.getUTCMonth() + 1).padStart(2, '0');
      const slotDay = String(slotDate.getUTCDate()).padStart(2, '0');
      const slotDateStr = `${slotYear}-${slotMonth}-${slotDay}`;
      
      return slotDateStr === targetDateStr;
    });
  };

  // Format time for display
  const formatTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return timeStr;
    }
  };

  // Delete an availability slot with confirmation
  const handleDeleteSlot = async (slot: any) => {
    const confirmMessage = `Are you sure you want to delete this availability slot?\n\n${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}\n${slot.totalCapacity} spots • $${slot.baseRate}/hr\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      await deleteSlot(slot.id);
      
      // Remove the deleted slot from the existing slots
      setExistingSlots(prev => prev.filter(existingSlot => existingSlot.id !== slot.id));
      
      alert('✅ Availability slot deleted successfully!');
    } catch (error) {
      console.error('Failed to delete slot:', error);
      alert('❌ Failed to delete availability slot. Please try again.');
    }
  };

  // Delete all existing slots for the current week
  const handleDeleteAllWeekSlots = async () => {
    if (existingSlots.length === 0) {
      alert('No availability slots to delete for this week.');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ALL ${existingSlots.length} availability slots for this week?\n\nThis will remove your entire schedule for ${formatDate(weekDates[0])} - ${formatDate(weekDates[6])}.\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // Delete all slots one by one
      for (const slot of existingSlots) {
        await deleteSlot(slot.id);
      }
      
      // Clear all existing slots
      setExistingSlots([]);
      
      alert(`✅ Successfully deleted ${existingSlots.length} availability slots!`);
    } catch (error) {
      console.error('Failed to delete week slots:', error);
      alert('❌ Failed to delete some availability slots. Please try again.');
    }
  };

  // Delete all existing slots for a specific day
  const handleDeleteDaySlots = async (date: Date, dayName: string) => {
    const daySlots = getExistingSlotsForDay(date);
    
    if (daySlots.length === 0) {
      alert(`No availability slots to delete for ${dayName}.`);
      return;
    }

    const confirmMessage = `Are you sure you want to delete ALL ${daySlots.length} availability slots for ${dayName}, ${formatDate(date)}?\n\nSlots to be deleted:\n${daySlots.map(slot => `• ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)} (${slot.totalCapacity} spots)`).join('\n')}\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      // Delete all slots for this day
      for (const slot of daySlots) {
        await deleteSlot(slot.id);
      }
      
      // Remove the deleted slots from the existing slots
      setExistingSlots(prev => prev.filter(existingSlot => 
        !daySlots.some(daySlot => daySlot.id === existingSlot.id)
      ));
      
      alert(`✅ Successfully deleted ${daySlots.length} availability slots for ${dayName}!`);
    } catch (error) {
      console.error('Failed to delete day slots:', error);
      alert(`❌ Failed to delete some availability slots for ${dayName}. Please try again.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Weekly Schedule Builder</h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create your availability schedule easily and quickly
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center"
          >
            {viewMode === 'grid' ? (
              <>
                <ListBulletIcon className="h-4 w-4 mr-2" />
                List View
              </>
            ) : (
              <>
                <Squares2X2Icon className="h-4 w-4 mr-2" />
                Grid View
              </>
            )}
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition flex items-center"
          >
            <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
            Use Template
          </button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          
          <div className="text-center">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              Week of {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
            </h4>
          </div>
          
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Global Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Default Settings</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Available Spots
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={globalSettings.capacity}
              onChange={(e) => setGlobalSettings({...globalSettings, capacity: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Hourly Rate ($)
            </label>
            <input
              type="number"
              min="10"
              max="200"
              step="5"
              value={globalSettings.rate}
              onChange={(e) => setGlobalSettings({...globalSettings, rate: parseFloat(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>
      </div>

      {/* Schedule Builder */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DAYS.map((day, index) => {
            const existingSlot = scheduleSlots.find(slot => slot.day === day);
            const date = weekDates[index];
            const isToday = date.toDateString() === new Date().toDateString();
            const isPast = date < new Date() && !isToday;
            
            return (
              <div key={day} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 ${isPast ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h5 className={`font-semibold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                      {day}
                    </h5>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {existingSlot && (
                      <button
                        onClick={() => removeDaySlot(day)}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Remove from draft"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                    {getExistingSlotsForDay(date).length > 0 && (
                      <button
                        onClick={() => handleDeleteDaySlots(date, day)}
                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title={`Delete all posted availability for ${day}`}
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Time
                    </label>
                    <select
                      value={existingSlot?.startTime || ''}
                      onChange={(e) => updateDaySlot(day, e.target.value, existingSlot?.endTime || '17:00')}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select time</option>
                      {COMMON_TIMES.map(time => (
                        <option key={time.value} value={time.value}>
                          {time.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Time
                    </label>
                    <select
                      value={existingSlot?.endTime || ''}
                      onChange={(e) => updateDaySlot(day, existingSlot?.startTime || '09:00', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select time</option>
                      {COMMON_TIMES.map(time => (
                        <option key={time.value} value={time.value}>
                          {time.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {existingSlot && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {existingSlot.capacity} spots • ${existingSlot.rate}/hr
                      </p>
                    </div>
                  )}

                  {/* Show existing availability slots */}
                  {getExistingSlotsForDay(date).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                      <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">
                        ✅ Posted Availability ({getExistingSlotsForDay(date).length}):
                      </p>
                      {getExistingSlotsForDay(date).map((slot, idx) => (
                        <div key={idx} className="bg-green-50 dark:bg-green-900/20 rounded p-2 mb-1 relative group">
                          <button
                            onClick={() => handleDeleteSlot(slot)}
                            className="absolute top-1 right-1 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete this availability slot"
                          >
                            <XMarkIcon className="h-3 w-3" />
                          </button>
                          <p className="text-xs text-green-800 dark:text-green-300 font-medium pr-5">
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            {slot.availableSpots || slot.totalCapacity} spots • ${slot.baseRate}/hr
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white">Weekly Schedule</h4>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {DAYS.map((day, index) => {
              const existingSlot = scheduleSlots.find(slot => slot.day === day);
              const date = weekDates[index];
              const isToday = date.toDateString() === new Date().toDateString();
              
              return (
                <div key={day} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-24">
                      <h5 className={`font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                        {day}
                      </h5>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(date)}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <select
                        value={existingSlot?.startTime || ''}
                        onChange={(e) => updateDaySlot(day, e.target.value, existingSlot?.endTime || '17:00')}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">Start time</option>
                        {COMMON_TIMES.map(time => (
                          <option key={time.value} value={time.value}>
                            {time.label}
                          </option>
                        ))}
                      </select>
                      
                      <span className="text-gray-400">to</span>
                      
                      <select
                        value={existingSlot?.endTime || ''}
                        onChange={(e) => updateDaySlot(day, existingSlot?.startTime || '09:00', e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                      >
                        <option value="">End time</option>
                        {COMMON_TIMES.map(time => (
                          <option key={time.value} value={time.value}>
                            {time.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      {existingSlot && (
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {existingSlot.capacity} spots • ${existingSlot.rate}/hr
                          </span>
                          <button
                            onClick={() => removeDaySlot(day)}
                            className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Remove from draft"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      
                      {getExistingSlotsForDay(date).length > 0 && (
                        <button
                          onClick={() => handleDeleteDaySlots(date, day)}
                          className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          title={`Delete all posted availability for ${day} (${getExistingSlotsForDay(date).length} slots)`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    {/* Show existing availability slots in list view */}
                    {getExistingSlotsForDay(date).length > 0 && (
                      <div className="mt-2 text-right">
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                          ✅ Posted Availability ({getExistingSlotsForDay(date).length})
                        </p>
                        <div className="space-y-1">
                          {getExistingSlotsForDay(date).map((slot, idx) => (
                            <div key={idx} className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs px-2 py-1 rounded flex items-center justify-between group">
                              <span>
                                {formatTime(slot.startTime)} - {formatTime(slot.endTime)} ({slot.availableSpots || slot.totalCapacity} spots)
                              </span>
                              <button
                                onClick={() => handleDeleteSlot(slot)}
                                className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Delete this availability slot"
                              >
                                <XMarkIcon className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={copyToNextWeek}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center"
          >
            <DocumentDuplicateIcon className="h-4 w-4 mr-2" />
            Copy to Next Week
          </button>
          <button
            onClick={() => setScheduleSlots([])}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Clear Draft
          </button>
          {existingSlots.length > 0 && (
            <button
              onClick={handleDeleteAllWeekSlots}
              className="px-4 py-2 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center"
            >
              <XMarkIcon className="h-4 w-4 mr-2" />
              Delete All Posted ({existingSlots.length})
            </button>
          )}
        </div>
        
        <button
          onClick={submitSchedule}
          disabled={scheduleSlots.length === 0 || loading || isSubmitting}
          className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {(loading || isSubmitting) ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <CheckIcon className="h-4 w-4 mr-2" />
          )}
          {isSubmitting ? 'Creating Schedule...' : `Create Schedule (${scheduleSlots.length} days)`}
        </button>
      </div>

      {/* Template Modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Choose a Schedule Template</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Start with a pre-built schedule and customize as needed</p>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SCHEDULE_TEMPLATES.map((template, index) => (
                <button
                  key={index}
                  onClick={() => applyTemplate(template)}
                  className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-left"
                >
                  <div className="flex items-center mb-3">
                    <span className="text-2xl mr-3">{template.icon}</span>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{template.name}</h4>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{template.description}</p>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {template.schedule.length} day{template.schedule.length !== 1 ? 's' : ''} scheduled
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
              <button
                onClick={() => setShowTemplates(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition"
              >
                I'll create my own schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}