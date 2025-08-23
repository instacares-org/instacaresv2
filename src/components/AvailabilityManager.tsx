"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  CalendarDaysIcon, 
  ClockIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon
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
  recurringDays?: string[];
  notes?: string;
  status?: string;
  currentOccupancy?: number;
  availableSpots?: number;
}

interface AvailabilityManagerProps {
  caregiverId: string;
  defaultCapacity?: number;
  defaultRate?: number;
}

export default function AvailabilityManager({ 
  caregiverId, 
  defaultCapacity = 4, 
  defaultRate = 25 
}: AvailabilityManagerProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  
  const { getAvailableSlots, createSlot, updateSlot, deleteSlot, error } = useAvailability();

  // Load existing slots
  const loadSlots = useCallback(async () => {
    setLoading(true);
    try {
      // Get start and end of selected week
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

      console.log('Loaded slots:', availableSlots);
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

  // Navigate weeks
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
  const weekStart = weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekEnd = weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Availability Schedule</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Set your available hours for parents to book
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Availability
        </button>
      </div>

      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <button
          onClick={goToPreviousWeek}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <div className="flex items-center space-x-4">
          <h4 className="font-medium text-gray-900 dark:text-white">
            {weekStart} - {weekEnd}
          </h4>
          <button
            onClick={goToThisWeek}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            This Week
          </button>
        </div>
        
        <button
          onClick={goToNextWeek}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
          {weekDates.map((date) => {
            const daySlots = slots.filter(slot => {
              const slotDate = new Date(slot.date);
              return slotDate.toDateString() === date.toDateString();
            });
            
            const isToday = date.toDateString() === new Date().toDateString();
            const isPast = date < new Date() && !isToday;
            
            return (
              <div key={date.toISOString()} className="bg-white dark:bg-gray-800">
                <div className={`p-3 border-b border-gray-200 dark:border-gray-700 ${
                  isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                } ${isPast ? 'opacity-50' : ''}`}>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-lg font-semibold ${
                    isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                  }`}>
                    {date.getDate()}
                  </div>
                </div>
                
                <div className="p-2 min-h-[150px]">
                  {daySlots.length === 0 ? (
                    <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
                      No availability
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-2 text-xs hover:bg-green-100 dark:hover:bg-green-900/30 transition group"
                        >
                          <div className="flex items-center justify-between">
                            <ClockIcon className="h-3 w-3 text-green-600 dark:text-green-400" />
                            <div className="flex items-center space-x-1">
                              <span className="text-green-700 dark:text-green-300 font-medium">
                                {slot.availableSpots}/{slot.totalCapacity}
                              </span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingSlot(slot);
                                  }}
                                  className="p-1 hover:bg-green-200 dark:hover:bg-green-800 rounded"
                                  title="Edit slot"
                                >
                                  <PencilIcon className="h-3 w-3 text-green-600 dark:text-green-400" />
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm('Are you sure you want to delete this time slot?')) {
                                      try {
                                        await deleteSlot(slot.id!);
                                        await loadSlots();
                                      } catch (err) {
                                        alert(`Failed to delete slot: ${err instanceof Error ? err.message : 'Unknown error'}`);
                                      }
                                    }
                                  }}
                                  className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded"
                                  title="Delete slot"
                                >
                                  <TrashIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div 
                            className="text-gray-700 dark:text-gray-300 mt-1 cursor-pointer"
                            onClick={() => setEditingSlot(slot)}
                          >
                            {(() => {
                              try {
                                const startTime = new Date(slot.startTime);
                                const endTime = new Date(slot.endTime);
                                
                                if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                                  return 'Invalid time';
                                }
                                
                                return `${startTime.toLocaleTimeString([], { 
                                  hour: 'numeric', 
                                  minute: '2-digit',
                                  hour12: true 
                                })} - ${endTime.toLocaleTimeString([], { 
                                  hour: 'numeric', 
                                  minute: '2-digit',
                                  hour12: true 
                                })}`;
                              } catch (error) {
                                return 'Invalid time';
                              }
                            })()}
                          </div>
                          <div 
                            className="text-gray-600 dark:text-gray-400 cursor-pointer"
                            onClick={() => setEditingSlot(slot)}
                          >
                            ${slot.baseRate}/hr
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {(showAddForm || editingSlot) && (
        <TimeSlotForm
          slot={editingSlot}
          defaultCapacity={defaultCapacity}
          defaultRate={defaultRate}
          onSave={async (slotData) => {
            try {
              if (editingSlot) {
                // Update existing slot
                await updateSlot(editingSlot.id!, {
                  date: slotData.date,
                  startTime: slotData.startTime,
                  endTime: slotData.endTime,
                  totalCapacity: slotData.totalCapacity,
                  baseRate: slotData.baseRate,
                  notes: slotData.notes
                });
              } else {
                // Create new slot
                await createSlot(slotData);
              }
              await loadSlots();
              setShowAddForm(false);
              setEditingSlot(null);
            } catch (err) {
              console.error('Failed to save slot:', err);
              alert(`Failed to ${editingSlot ? 'update' : 'create'} slot: ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          }}
          onCancel={() => {
            setShowAddForm(false);
            setEditingSlot(null);
          }}
        />
      )}
    </div>
  );
}

// Time Slot Form Component
function TimeSlotForm({ 
  slot, 
  defaultCapacity,
  defaultRate,
  onSave, 
  onCancel 
}: { 
  slot?: TimeSlot | null;
  defaultCapacity: number;
  defaultRate: number;
  onSave: (slot: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    date: slot?.date ? new Date(slot.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    startTime: slot?.startTime ? new Date(slot.startTime).toTimeString().split(' ')[0].substring(0, 5) : '09:00',
    endTime: slot?.endTime ? new Date(slot.endTime).toTimeString().split(' ')[0].substring(0, 5) : '17:00',
    totalCapacity: slot?.totalCapacity || defaultCapacity,
    baseRate: slot?.baseRate || defaultRate,
    isRecurring: slot?.isRecurring || false,
    recurringDays: slot?.recurringDays || [],
    notes: slot?.notes || ''
  });

  const [isRecurringExpanded, setIsRecurringExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate times
    if (formData.startTime >= formData.endTime) {
      alert('End time must be after start time');
      return;
    }
    
    // Format the data for API
    const slotData = {
      date: formData.date,
      startTime: `${formData.date}T${formData.startTime}:00.000Z`,
      endTime: `${formData.date}T${formData.endTime}:00.000Z`,
      totalCapacity: formData.totalCapacity,
      baseRate: formData.baseRate,
      isRecurring: formData.isRecurring,
      recurringPattern: formData.isRecurring ? { days: formData.recurringDays } : null,
      notes: formData.notes
    };
    
    console.log('Submitting slot data:', slotData);
    onSave(slotData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {slot ? 'Edit Availability' : 'Add Availability'}
          </h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
              required
            />
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Time
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Time
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
          </div>

          {/* Capacity and Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Available Spots
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.totalCapacity}
                onChange={(e) => setFormData({ ...formData, totalCapacity: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                required
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
                value={formData.baseRate}
                onChange={(e) => setFormData({ ...formData, baseRate: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
          </div>

          {/* Recurring Option */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="recurring"
                checked={formData.isRecurring}
                onChange={(e) => {
                  setFormData({ ...formData, isRecurring: e.target.checked });
                  setIsRecurringExpanded(e.target.checked);
                }}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label htmlFor="recurring" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Repeat weekly
              </label>
            </div>
            
            {isRecurringExpanded && (
              <div className="mt-3 pl-7">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  This slot will repeat every week on the same day
                </p>
                <div className="text-xs text-orange-600 dark:text-orange-400">
                  ⚠️ This will create slots for the next 4 weeks
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500"
              placeholder="Any special notes about this time slot..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition shadow-sm"
            >
              {slot ? 'Update' : 'Add'} Availability
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}