"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDaysIcon,
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { addCSRFHeader } from '@/lib/csrf';

interface BabysitterScheduleBuilderProps {
  onScheduleUpdate?: (slots: AvailabilitySlot[]) => void;
}

type RecurrenceType = 'ONCE' | 'WEEKLY' | 'MONTHLY';

interface AvailabilitySlot {
  id: string;
  recurrenceType: RecurrenceType;
  dayOfWeek?: number | null;
  day?: string | null;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  specificDate?: string | null;
  dayOfMonth?: number | null;
  repeatInterval?: number;
  anchorDate?: string | null;
}

interface ScheduleSlot {
  recurrenceType: RecurrenceType;
  day?: string;
  dayOfWeek?: number;
  startTime: string;
  endTime: string;
  specificDate?: string;
  dayOfMonth?: number;
  repeatInterval?: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const COMMON_TIMES = [
  { label: '6:00 AM', value: '06:00' },
  { label: '7:00 AM', value: '07:00' },
  { label: '8:00 AM', value: '08:00' },
  { label: '9:00 AM', value: '09:00' },
  { label: '10:00 AM', value: '10:00' },
  { label: '11:00 AM', value: '11:00' },
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
  { label: '10:00 PM', value: '22:00' },
];

const SCHEDULE_TEMPLATES = [
  {
    name: "Weekday Mornings",
    icon: "🌅",
    description: "Monday to Friday, 7 AM - 1 PM",
    schedule: [
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Monday', dayOfWeek: 1, startTime: '07:00', endTime: '13:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Tuesday', dayOfWeek: 2, startTime: '07:00', endTime: '13:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Wednesday', dayOfWeek: 3, startTime: '07:00', endTime: '13:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Thursday', dayOfWeek: 4, startTime: '07:00', endTime: '13:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Friday', dayOfWeek: 5, startTime: '07:00', endTime: '13:00', repeatInterval: 1 },
    ]
  },
  {
    name: "Weekday Afternoons",
    icon: "☀️",
    description: "Monday to Friday, 2 PM - 8 PM",
    schedule: [
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Monday', dayOfWeek: 1, startTime: '14:00', endTime: '20:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Tuesday', dayOfWeek: 2, startTime: '14:00', endTime: '20:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Wednesday', dayOfWeek: 3, startTime: '14:00', endTime: '20:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Thursday', dayOfWeek: 4, startTime: '14:00', endTime: '20:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Friday', dayOfWeek: 5, startTime: '14:00', endTime: '20:00', repeatInterval: 1 },
    ]
  },
  {
    name: "Weekday Full Day",
    icon: "📋",
    description: "Monday to Friday, 8 AM - 6 PM",
    schedule: [
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Monday', dayOfWeek: 1, startTime: '08:00', endTime: '18:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Tuesday', dayOfWeek: 2, startTime: '08:00', endTime: '18:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Wednesday', dayOfWeek: 3, startTime: '08:00', endTime: '18:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Thursday', dayOfWeek: 4, startTime: '08:00', endTime: '18:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Friday', dayOfWeek: 5, startTime: '08:00', endTime: '18:00', repeatInterval: 1 },
    ]
  },
  {
    name: "Weekend Availability",
    icon: "🎉",
    description: "Saturday & Sunday, 9 AM - 9 PM",
    schedule: [
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Saturday', dayOfWeek: 6, startTime: '09:00', endTime: '21:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Sunday', dayOfWeek: 0, startTime: '09:00', endTime: '21:00', repeatInterval: 1 },
    ]
  },
  {
    name: "Evening Babysitter",
    icon: "🌙",
    description: "Weekdays, 5 PM - 11 PM",
    schedule: [
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Monday', dayOfWeek: 1, startTime: '17:00', endTime: '23:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Tuesday', dayOfWeek: 2, startTime: '17:00', endTime: '23:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Wednesday', dayOfWeek: 3, startTime: '17:00', endTime: '23:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Thursday', dayOfWeek: 4, startTime: '17:00', endTime: '23:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Friday', dayOfWeek: 5, startTime: '17:00', endTime: '23:00', repeatInterval: 1 },
    ]
  },
  {
    name: "Full Week Coverage",
    icon: "📆",
    description: "All days, 8 AM - 8 PM",
    schedule: [
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Sunday', dayOfWeek: 0, startTime: '08:00', endTime: '20:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Monday', dayOfWeek: 1, startTime: '08:00', endTime: '20:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Tuesday', dayOfWeek: 2, startTime: '08:00', endTime: '20:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Wednesday', dayOfWeek: 3, startTime: '08:00', endTime: '20:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Thursday', dayOfWeek: 4, startTime: '08:00', endTime: '20:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Friday', dayOfWeek: 5, startTime: '08:00', endTime: '20:00', repeatInterval: 1 },
      { recurrenceType: 'WEEKLY' as RecurrenceType, day: 'Saturday', dayOfWeek: 6, startTime: '08:00', endTime: '20:00', repeatInterval: 1 },
    ]
  }
];

export default function BabysitterScheduleBuilder({
  onScheduleUpdate
}: BabysitterScheduleBuilderProps) {
  const [existingSlots, setExistingSlots] = useState<AvailabilitySlot[]>([]);
  const [scheduleSlots, setScheduleSlots] = useState<ScheduleSlot[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalRecurrenceType, setModalRecurrenceType] = useState<RecurrenceType>('WEEKLY');
  const [newSlot, setNewSlot] = useState<ScheduleSlot>({
    recurrenceType: 'WEEKLY',
    day: 'Monday',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    repeatInterval: 1,
  });

  // Fetch existing availability — returns the fetched slots
  const fetchAvailability = useCallback(async (): Promise<AvailabilitySlot[]> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/babysitter/availability');
      if (response.ok) {
        const data = await response.json();
        const result = data.data || data;
        const slots = result.slots || [];
        setExistingSlots(slots);
        return slots;
      }
    } catch (err) {
      console.error('Failed to fetch availability:', err);
      setError('Failed to load availability');
    } finally {
      setIsLoading(false);
    }
    return [];
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Apply template
  const applyTemplate = (template: typeof SCHEDULE_TEMPLATES[0]) => {
    setScheduleSlots(template.schedule);
    setShowTemplates(false);
  };

  // Reset modal when recurrence type changes
  const handleRecurrenceTypeChange = (type: RecurrenceType) => {
    setModalRecurrenceType(type);
    const today = new Date().toISOString().split('T')[0];
    if (type === 'WEEKLY') {
      setNewSlot({
        recurrenceType: 'WEEKLY',
        day: 'Monday',
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '17:00',
        repeatInterval: 1,
      });
    } else if (type === 'ONCE') {
      setNewSlot({
        recurrenceType: 'ONCE',
        specificDate: today,
        startTime: '09:00',
        endTime: '17:00',
      });
    } else {
      setNewSlot({
        recurrenceType: 'MONTHLY',
        dayOfMonth: 1,
        startTime: '09:00',
        endTime: '17:00',
      });
    }
  };

  // Add a new slot
  const addSlot = () => {
    if (newSlot.startTime >= newSlot.endTime) {
      setError('End time must be after start time');
      return;
    }

    // Duplicate check based on type
    const exists = scheduleSlots.some(s => {
      if (s.recurrenceType !== newSlot.recurrenceType) return false;
      if (s.startTime !== newSlot.startTime || s.endTime !== newSlot.endTime) return false;
      if (s.recurrenceType === 'WEEKLY') return s.dayOfWeek === newSlot.dayOfWeek;
      if (s.recurrenceType === 'ONCE') return s.specificDate === newSlot.specificDate;
      return s.dayOfMonth === newSlot.dayOfMonth;
    });

    if (exists) {
      setError('This time slot already exists');
      return;
    }

    setScheduleSlots([...scheduleSlots, { ...newSlot }]);
    setShowAddModal(false);
    setError(null);
  };

  // Remove a slot from the schedule
  const removeScheduleSlot = (index: number) => {
    setScheduleSlots(scheduleSlots.filter((_, i) => i !== index));
  };

  // Delete an existing slot
  const deleteExistingSlot = async (slotId: string) => {
    try {
      const response = await fetch(`/api/babysitter/availability?id=${slotId}`, {
        method: 'DELETE',
        headers: addCSRFHeader(),
      });

      if (response.ok) {
        setExistingSlots(existingSlots.filter(s => s.id !== slotId));
        setSuccess('Slot removed successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to delete slot');
      }
    } catch (err) {
      setError('Failed to delete slot');
    }
  };

  // Save schedule
  const saveSchedule = async () => {
    if (scheduleSlots.length === 0) {
      setError('Please add at least one time slot');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const slotsToSave = scheduleSlots.map(slot => {
        if (slot.recurrenceType === 'WEEKLY') {
          return {
            recurrenceType: 'WEEKLY',
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            repeatInterval: slot.repeatInterval || 1,
          };
        }
        if (slot.recurrenceType === 'ONCE') {
          return {
            recurrenceType: 'ONCE',
            specificDate: slot.specificDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
          };
        }
        // MONTHLY
        return {
          recurrenceType: 'MONTHLY',
          dayOfMonth: slot.dayOfMonth,
          startTime: slot.startTime,
          endTime: slot.endTime,
        };
      });

      const response = await fetch('/api/babysitter/availability', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(slotsToSave),
      });

      if (response.ok) {
        setSuccess('Schedule saved successfully!');
        setScheduleSlots([]);
        const freshSlots = await fetchAvailability();
        onScheduleUpdate?.(freshSlots);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to save schedule');
      }
    } catch (err) {
      setError('Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  // Format time for display
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get ordinal suffix
  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  // Calendar helpers
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const firstDayOfWeek = new Date(calendarYear, calendarMonthIndex, 1).getDay(); // 0=Sun
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonth = () => setCalendarMonth(new Date(calendarYear, calendarMonthIndex - 1, 1));
  const nextMonth = () => setCalendarMonth(new Date(calendarYear, calendarMonthIndex + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const monthLabel = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Get slots for a specific calendar date
  const getSlotsForDate = (dateNum: number) => {
    const date = new Date(calendarYear, calendarMonthIndex, dateNum);
    const dow = date.getDay(); // 0-6
    const dateStr = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;

    const existing: { slot: AvailabilitySlot; type: RecurrenceType }[] = [];
    const pending: { slot: ScheduleSlot; index: number; type: RecurrenceType }[] = [];

    // Weekly existing
    existingSlots.forEach(s => {
      if (s.recurrenceType === 'WEEKLY' && s.dayOfWeek === dow) {
        existing.push({ slot: s, type: 'WEEKLY' });
      }
      if (s.recurrenceType === 'ONCE' && s.specificDate) {
        const slotDate = new Date(s.specificDate);
        if (slotDate.getFullYear() === calendarYear && slotDate.getMonth() === calendarMonthIndex && slotDate.getDate() === dateNum) {
          existing.push({ slot: s, type: 'ONCE' });
        }
      }
      if (s.recurrenceType === 'MONTHLY' && s.dayOfMonth === dateNum) {
        existing.push({ slot: s, type: 'MONTHLY' });
      }
    });

    // Pending (new) slots
    scheduleSlots.forEach((s, idx) => {
      if (s.recurrenceType === 'WEEKLY' && s.dayOfWeek === dow) {
        pending.push({ slot: s, index: idx, type: 'WEEKLY' });
      }
      if (s.recurrenceType === 'ONCE' && s.specificDate === dateStr) {
        pending.push({ slot: s, index: idx, type: 'ONCE' });
      }
      if (s.recurrenceType === 'MONTHLY' && s.dayOfMonth === dateNum) {
        pending.push({ slot: s, index: idx, type: 'MONTHLY' });
      }
    });

    return { existing, pending };
  };

  const typeClasses = (type: RecurrenceType) => {
    if (type === 'WEEKLY') return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    if (type === 'ONCE') return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300';
    return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Availability Schedule</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Set your weekly, one-time, or monthly availability
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <DocumentDuplicateIcon className="h-5 w-5 mr-2" />
            Templates
          </button>
          <button
            onClick={() => {
              handleRecurrenceTypeChange('WEEKLY');
              setShowAddModal(true);
            }}
            className="flex items-center px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Add Time Slot
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <XMarkIcon className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-700 dark:text-red-300">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto">
              <XMarkIcon className="h-4 w-4 text-red-500" />
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center">
            <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-green-700 dark:text-green-300">{success}</span>
          </div>
        </div>
      )}

      {/* Templates Dropdown */}
      {showTemplates && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Quick Templates</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SCHEDULE_TEMPLATES.map((template, index) => (
              <button
                key={index}
                onClick={() => applyTemplate(template)}
                className="flex items-start p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 hover:shadow-sm transition text-left"
              >
                <span className="text-2xl mr-3">{template.icon}</span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm">{template.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{template.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ======================== MONTHLY CALENDAR ======================== */}
      <div>
        {/* Calendar header with month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
              {monthLabel}
            </h4>
            <button
              onClick={goToToday}
              className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Today
            </button>
          </div>
          <button
            onClick={nextMonth}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          >
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-green-500"></span>
            <span className="text-gray-600 dark:text-gray-400">Weekly</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-purple-500"></span>
            <span className="text-gray-600 dark:text-gray-400">One-Time</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-orange-500"></span>
            <span className="text-gray-600 dark:text-gray-400">Monthly</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm border-2 border-dashed border-blue-400 bg-blue-100 dark:bg-blue-900"></span>
            <span className="text-gray-600 dark:text-gray-400">Pending (unsaved)</span>
          </div>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDayOfWeek }, (_, i) => (
            <div key={`empty-${i}`} className="min-h-[90px] bg-gray-50 dark:bg-gray-800/50 rounded-lg" />
          ))}

          {/* Date cells */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const dateNum = i + 1;
            const cellDate = new Date(calendarYear, calendarMonthIndex, dateNum);
            cellDate.setHours(0, 0, 0, 0);
            const isToday = cellDate.getTime() === today.getTime();
            const { existing, pending } = getSlotsForDate(dateNum);
            const hasSlots = existing.length > 0 || pending.length > 0;

            return (
              <div
                key={dateNum}
                className={`min-h-[90px] rounded-lg border p-1.5 transition ${
                  isToday
                    ? 'border-green-500 dark:border-green-400 bg-green-50/50 dark:bg-green-900/10'
                    : hasSlots
                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                    : 'border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/80'
                }`}
              >
                {/* Date number */}
                <div className={`text-xs font-medium mb-1 ${
                  isToday
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {isToday ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-[10px]">
                      {dateNum}
                    </span>
                  ) : dateNum}
                </div>

                {/* Slot chips */}
                <div className="space-y-0.5">
                  {existing.map((item, idx) => (
                    <div key={`e-${idx}`} className="relative group">
                      <div className={`${typeClasses(item.type)} rounded px-1 py-0.5 text-[10px] leading-tight truncate`}>
                        {formatTime(item.slot.startTime)}-{formatTime(item.slot.endTime)}
                        {item.type === 'WEEKLY' && item.slot.repeatInterval && item.slot.repeatInterval > 1 && (
                          <span className="opacity-70"> {item.slot.repeatInterval}w</span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteExistingSlot(item.slot.id)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition z-10"
                      >
                        <XMarkIcon className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  {pending.map((item, idx) => (
                    <div key={`p-${idx}`} className="relative group">
                      <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-1 py-0.5 text-[10px] leading-tight truncate border border-dashed border-blue-300 dark:border-blue-600">
                        {formatTime(item.slot.startTime)}-{formatTime(item.slot.endTime)}
                      </div>
                      <button
                        onClick={() => removeScheduleSlot(item.index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition z-10"
                      >
                        <XMarkIcon className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary under calendar */}
        {existingSlots.length === 0 && scheduleSlots.length === 0 && (
          <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-6">
            No availability set. Click &quot;Add Time Slot&quot; to get started.
          </div>
        )}
      </div>

      {/* Save Button */}
      {scheduleSlots.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <strong>{scheduleSlots.length}</strong> new time slot{scheduleSlots.length !== 1 ? 's' : ''} to save
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setScheduleSlots([])}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Clear All
            </button>
            <button
              onClick={saveSchedule}
              disabled={isSaving}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Save Schedule
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ======================== ADD SLOT MODAL ======================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
            <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowAddModal(false)} />

            <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-md w-full mx-auto shadow-xl">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Time Slot</h3>
                  <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-500">
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Recurrence Type Tabs */}
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden mb-5">
                  {(['WEEKLY', 'ONCE', 'MONTHLY'] as RecurrenceType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleRecurrenceTypeChange(type)}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition ${
                        modalRecurrenceType === type
                          ? 'bg-green-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {type === 'WEEKLY' ? 'Weekly' : type === 'ONCE' ? 'One-Time' : 'Monthly'}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {/* WEEKLY fields */}
                  {modalRecurrenceType === 'WEEKLY' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Day</label>
                        <select
                          value={newSlot.day}
                          onChange={(e) => {
                            const dayIndex = DAYS.indexOf(e.target.value);
                            setNewSlot({ ...newSlot, day: e.target.value, dayOfWeek: dayIndex });
                          }}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500"
                        >
                          {DAYS.map((day) => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Repeat Every</label>
                        <select
                          value={newSlot.repeatInterval || 1}
                          onChange={(e) => setNewSlot({ ...newSlot, repeatInterval: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500"
                        >
                          <option value={1}>Every week</option>
                          <option value={2}>Every 2 weeks</option>
                          <option value={3}>Every 3 weeks</option>
                          <option value={4}>Every 4 weeks</option>
                        </select>
                      </div>
                    </>
                  )}

                  {/* ONCE fields */}
                  {modalRecurrenceType === 'ONCE' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date</label>
                      <input
                        type="date"
                        value={newSlot.specificDate || ''}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setNewSlot({ ...newSlot, specificDate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  )}

                  {/* MONTHLY fields */}
                  {modalRecurrenceType === 'MONTHLY' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Day of Month</label>
                      <select
                        value={newSlot.dayOfMonth || 1}
                        onChange={(e) => setNewSlot({ ...newSlot, dayOfMonth: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500"
                      >
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>{getOrdinal(d)}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Time pickers (shared by all types) */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Time</label>
                      <select
                        value={newSlot.startTime}
                        onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500"
                      >
                        {COMMON_TIMES.map((time) => (
                          <option key={time.value} value={time.value}>{time.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Time</label>
                      <select
                        value={newSlot.endTime}
                        onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-green-500 focus:border-green-500"
                      >
                        {COMMON_TIMES.map((time) => (
                          <option key={time.value} value={time.value}>{time.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addSlot}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
                    >
                      Add Slot
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
