"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { 
  CameraIcon, 
  ClockIcon, 
  MapPinIcon,
  UserIcon,
  HeartIcon,
  PlayIcon,
  DocumentTextIcon,
  CheckIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";

interface Activity {
  id?: string;
  type: string;
  description: string;
  time: string;
}

interface Meal {
  id?: string;
  type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  description: string;
  time: string;
  amountEaten: 'All' | 'Most' | 'Some' | 'Little' | 'None';
}

interface NapInfo {
  startTime: string;
  endTime: string;
  quality: 'Great' | 'Good' | 'Fair' | 'Poor';
  notes: string;
}

interface CheckInOutData {
  bookingId: string;
  childId: string;
  childName: string;
  childPhoto?: string;
  caregiverId: string;
  
  // Check-in
  checkInTime?: string;
  checkInPhotoUrl?: string;
  checkInNotes?: string;
  checkInLocation?: { lat: number; lng: number; };
  
  // Check-out
  checkOutTime?: string;
  checkOutPhotoUrl?: string;
  checkOutNotes?: string;
  checkOutLocation?: { lat: number; lng: number; };
  
  // Daily activities
  activities: Activity[];
  meals: Meal[];
  napTime?: NapInfo;
  behaviorNotes: string;
  
  status: 'PENDING' | 'CHECKED_IN' | 'CHECKED_OUT' | 'COMPLETED';
}

interface CheckInOutProps {
  data: CheckInOutData;
  onCheckIn: (data: Partial<CheckInOutData>) => void;
  onCheckOut: (data: Partial<CheckInOutData>) => void;
  onUpdateActivities: (data: Partial<CheckInOutData>) => void;
  isCaregiver: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export default function CheckInOut({ 
  data, 
  onCheckIn, 
  onCheckOut, 
  onUpdateActivities,
  isCaregiver,
  isOpen, 
  onClose 
}: CheckInOutProps) {
  const [activeTab, setActiveTab] = useState<'checkin' | 'activities' | 'checkout'>('checkin');
  const [checkInPhoto, setCheckInPhoto] = useState<string | null>(data.checkInPhotoUrl || null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<string | null>(data.checkOutPhotoUrl || null);
  const [checkInNotes, setCheckInNotes] = useState(data.checkInNotes || '');
  const [checkOutNotes, setCheckOutNotes] = useState(data.checkOutNotes || '');
  const [activities, setActivities] = useState<Activity[]>(data.activities || []);
  const [meals, setMeals] = useState<Meal[]>(data.meals || []);
  const [napTime, setNapTime] = useState<NapInfo | undefined>(data.napTime);
  const [behaviorNotes, setBehaviorNotes] = useState(data.behaviorNotes || '');
  const [takingPhoto, setTakingPhoto] = useState(false);
  
  const checkInFileRef = useRef<HTMLInputElement>(null);
  const checkOutFileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const getCurrentLocation = (): Promise<{ lat: number; lng: number; }> => {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          (error) => reject(error)
        );
      } else {
        reject(new Error('Geolocation not supported'));
      }
    });
  };

  const handlePhotoCapture = async (type: 'checkin' | 'checkout', file: File) => {
    setTakingPhoto(true);
    try {
      // In a real implementation, you would upload to your server/cloud storage
      const photoUrl = URL.createObjectURL(file);
      
      if (type === 'checkin') {
        setCheckInPhoto(photoUrl);
      } else {
        setCheckOutPhoto(photoUrl);
      }
    } catch (error) {
      console.error('Error capturing photo:', error);
      alert('Failed to capture photo');
    } finally {
      setTakingPhoto(false);
    }
  };

  const handleCheckIn = async () => {
    try {
      const location = await getCurrentLocation();
      const checkInData = {
        checkInTime: new Date().toISOString(),
        checkInPhotoUrl: checkInPhoto,
        checkInNotes,
        checkInLocation: location,
        status: 'CHECKED_IN' as const
      };
      
      onCheckIn(checkInData);
      setActiveTab('activities');
    } catch (error) {
      console.error('Check-in error:', error);
      // Proceed without location if permission denied
      const checkInData = {
        checkInTime: new Date().toISOString(),
        checkInPhotoUrl: checkInPhoto,
        checkInNotes,
        status: 'CHECKED_IN' as const
      };
      
      onCheckIn(checkInData);
      setActiveTab('activities');
    }
  };

  const handleCheckOut = async () => {
    try {
      const location = await getCurrentLocation();
      const checkOutData = {
        checkOutTime: new Date().toISOString(),
        checkOutPhotoUrl: checkOutPhoto,
        checkOutNotes,
        checkOutLocation: location,
        activities,
        meals,
        napTime,
        behaviorNotes,
        status: 'CHECKED_OUT' as const
      };
      
      onCheckOut(checkOutData);
      onClose();
    } catch (error) {
      console.error('Check-out error:', error);
      // Proceed without location if permission denied
      const checkOutData = {
        checkOutTime: new Date().toISOString(),
        checkOutPhotoUrl: checkOutPhoto,
        checkOutNotes,
        activities,
        meals,
        napTime,
        behaviorNotes,
        status: 'CHECKED_OUT' as const
      };
      
      onCheckOut(checkOutData);
      onClose();
    }
  };

  const addActivity = () => {
    const newActivity: Activity = {
      id: Date.now().toString(),
      type: '',
      description: '',
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
    setActivities([...activities, newActivity]);
  };

  const addMeal = () => {
    const newMeal: Meal = {
      id: Date.now().toString(),
      type: 'Snack',
      description: '',
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      amountEaten: 'All'
    };
    setMeals([...meals, newMeal]);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            {/* Child Photo */}
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              {data.childPhoto ? (
                <Image
                  src={data.childPhoto}
                  alt={data.childName}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-gray-400" />
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {data.childName}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Status: <span className="capitalize">{data.status.toLowerCase().replace('_', ' ')}</span>
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'checkin', label: 'Check In', disabled: data.status !== 'PENDING' },
            { id: 'activities', label: 'Daily Activities', disabled: data.status === 'PENDING' },
            { id: 'checkout', label: 'Check Out', disabled: data.status !== 'CHECKED_IN' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id as any)}
              disabled={tab.disabled}
              className={`px-6 py-3 text-sm font-medium transition ${
                activeTab === tab.id && !tab.disabled
                  ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400'
                  : tab.disabled
                  ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Check In Tab */}
          {activeTab === 'checkin' && (
            <div className="space-y-6">
              {data.status === 'PENDING' && isCaregiver && (
                <>
                  {/* Photo Capture */}
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Take Check-In Photo
                    </h3>
                    
                    {checkInPhoto ? (
                      <div className="relative inline-block">
                        <Image
                          src={checkInPhoto}
                          alt="Check-in photo"
                          width={200}
                          height={200}
                          className="rounded-lg object-cover"
                        />
                        <button
                          onClick={() => setCheckInPhoto(null)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8">
                        <CameraIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <input
                          ref={checkInFileRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => e.target.files?.[0] && handlePhotoCapture('checkin', e.target.files[0])}
                          className="hidden"
                        />
                        <button
                          onClick={() => checkInFileRef.current?.click()}
                          disabled={takingPhoto}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                        >
                          {takingPhoto ? 'Processing...' : 'Take Photo'}
                        </button>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          Take a photo of the child upon arrival
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Check-in Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Check-in Notes
                    </label>
                    <textarea
                      value={checkInNotes}
                      onChange={(e) => setCheckInNotes(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Any notes about the child's condition upon arrival..."
                    />
                  </div>

                  {/* Check In Button */}
                  <div className="text-center">
                    <button
                      onClick={handleCheckIn}
                      disabled={!checkInPhoto}
                      className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium"
                    >
                      <ClockIcon className="h-5 w-5 inline mr-2" />
                      Complete Check-In
                    </button>
                  </div>
                </>
              )}

              {data.status !== 'PENDING' && (
                <div className="text-center text-gray-600 dark:text-gray-400">
                  <CheckIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p>Child has been checked in at {data.checkInTime && new Date(data.checkInTime).toLocaleString()}</p>
                  {data.checkInPhotoUrl && (
                    <div className="mt-4">
                      <Image
                        src={data.checkInPhotoUrl}
                        alt="Check-in photo"
                        width={200}
                        height={200}
                        className="rounded-lg object-cover mx-auto"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Activities Tab */}
          {activeTab === 'activities' && (
            <div className="space-y-6">
              {/* Activities */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Activities</h3>
                  <button
                    onClick={addActivity}
                    className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition"
                  >
                    Add Activity
                  </button>
                </div>
                
                {activities.map((activity, index) => (
                  <div key={activity.id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={activity.type}
                        onChange={(e) => {
                          const updated = [...activities];
                          updated[index].type = e.target.value;
                          setActivities(updated);
                        }}
                        placeholder="Activity type"
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      />
                      <input
                        type="time"
                        value={activity.time}
                        onChange={(e) => {
                          const updated = [...activities];
                          updated[index].time = e.target.value;
                          setActivities(updated);
                        }}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      />
                      <input
                        type="text"
                        value={activity.description}
                        onChange={(e) => {
                          const updated = [...activities];
                          updated[index].description = e.target.value;
                          setActivities(updated);
                        }}
                        placeholder="Description"
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Meals */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">Meals & Snacks</h3>
                  <button
                    onClick={addMeal}
                    className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 transition"
                  >
                    Add Meal
                  </button>
                </div>
                
                {meals.map((meal, index) => (
                  <div key={meal.id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 mb-2">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <select
                        value={meal.type}
                        onChange={(e) => {
                          const updated = [...meals];
                          updated[index].type = e.target.value as any;
                          setMeals(updated);
                        }}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      >
                        <option value="Breakfast">Breakfast</option>
                        <option value="Lunch">Lunch</option>
                        <option value="Dinner">Dinner</option>
                        <option value="Snack">Snack</option>
                      </select>
                      <input
                        type="time"
                        value={meal.time}
                        onChange={(e) => {
                          const updated = [...meals];
                          updated[index].time = e.target.value;
                          setMeals(updated);
                        }}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      />
                      <input
                        type="text"
                        value={meal.description}
                        onChange={(e) => {
                          const updated = [...meals];
                          updated[index].description = e.target.value;
                          setMeals(updated);
                        }}
                        placeholder="What was served"
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      />
                      <select
                        value={meal.amountEaten}
                        onChange={(e) => {
                          const updated = [...meals];
                          updated[index].amountEaten = e.target.value as any;
                          setMeals(updated);
                        }}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded"
                      >
                        <option value="All">All</option>
                        <option value="Most">Most</option>
                        <option value="Some">Some</option>
                        <option value="Little">Little</option>
                        <option value="None">None</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Behavior Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Behavior & Mood Notes
                </label>
                <textarea
                  value={behaviorNotes}
                  onChange={(e) => setBehaviorNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="How was the child's behavior and mood today?"
                />
              </div>
            </div>
          )}

          {/* Check Out Tab */}
          {activeTab === 'checkout' && (
            <div className="space-y-6">
              {data.status === 'CHECKED_IN' && isCaregiver && (
                <>
                  {/* Photo Capture */}
                  <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Take Check-Out Photo
                    </h3>
                    
                    {checkOutPhoto ? (
                      <div className="relative inline-block">
                        <Image
                          src={checkOutPhoto}
                          alt="Check-out photo"
                          width={200}
                          height={200}
                          className="rounded-lg object-cover"
                        />
                        <button
                          onClick={() => setCheckOutPhoto(null)}
                          className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8">
                        <CameraIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <input
                          ref={checkOutFileRef}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => e.target.files?.[0] && handlePhotoCapture('checkout', e.target.files[0])}
                          className="hidden"
                        />
                        <button
                          onClick={() => checkOutFileRef.current?.click()}
                          disabled={takingPhoto}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                        >
                          {takingPhoto ? 'Processing...' : 'Take Photo'}
                        </button>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                          Take a photo of the child before departure
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Check-out Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Daily Summary & Check-out Notes
                    </label>
                    <textarea
                      value={checkOutNotes}
                      onChange={(e) => setCheckOutNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Summary of the day, any incidents, highlights, or notes for the parent..."
                    />
                  </div>

                  {/* Check Out Button */}
                  <div className="text-center">
                    <button
                      onClick={handleCheckOut}
                      disabled={!checkOutPhoto}
                      className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-medium"
                    >
                      <ClockIcon className="h-5 w-5 inline mr-2" />
                      Complete Check-Out
                    </button>
                  </div>
                </>
              )}

              {data.status === 'CHECKED_OUT' && (
                <div className="text-center text-gray-600 dark:text-gray-400">
                  <CheckIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p>Child has been checked out at {data.checkOutTime && new Date(data.checkOutTime).toLocaleString()}</p>
                  {data.checkOutPhotoUrl && (
                    <div className="mt-4">
                      <Image
                        src={data.checkOutPhotoUrl}
                        alt="Check-out photo"
                        width={200}
                        height={200}
                        className="rounded-lg object-cover mx-auto"
                      />
                    </div>
                  )}
                  <div className="mt-4 text-left bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Daily Summary:</h4>
                    <p>{data.checkOutNotes}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}