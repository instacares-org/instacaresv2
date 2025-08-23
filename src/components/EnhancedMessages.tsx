"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  PhoneIcon,
  VideoCameraIcon,
  PaperAirplaneIcon,
  FunnelIcon,
  StarIcon,
  MapPinIcon,
  BellIcon,
  BellSlashIcon,
  ArchiveBoxIcon,
  TrashIcon,
  EllipsisVerticalIcon
} from '@heroicons/react/24/outline';
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  ClockIcon as ClockIconSolid 
} from '@heroicons/react/24/solid';

interface ChatRoom {
  id: string;
  booking: {
    id: string;
    startTime: string;
    endTime: string;
    status: string;
    address: string;
    childrenCount: number;
    parent?: {
      id: string;
      email: string;
      profile: {
        firstName: string;
        lastName: string;
        phone?: string;
        avatar?: string;
      };
    };
    caregiver?: {
      id: string;
      email: string;
      profile: {
        firstName: string;
        lastName: string;
        phone?: string;
        avatar?: string;
      };
    };
  };
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    sender: {
      id: string;
      userType: string;
    };
  };
  unreadCount: number;
  lastMessageAt?: string;
  isActive: boolean;
  priority?: 'high' | 'normal' | 'low';
  isArchived?: boolean;
  isMuted?: boolean;
}

interface EnhancedMessagesProps {
  userId: string;
  userType: 'parent' | 'caregiver' | 'admin';
  rooms: ChatRoom[];
  onRoomSelect: (roomId: string) => void;
  selectedRoom?: string;
}

type SortBy = 'recent' | 'unread' | 'upcoming' | 'status' | 'name';
type FilterBy = 'all' | 'unread' | 'active' | 'archived' | 'priority';

export default function EnhancedMessages({ 
  userId, 
  userType, 
  rooms, 
  onRoomSelect, 
  selectedRoom 
}: EnhancedMessagesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Get the other user for each room
  const getOtherUser = (room: ChatRoom) => {
    return userType === 'parent' ? room.booking.caregiver : room.booking.parent;
  };

  // Filter and sort rooms
  const filteredAndSortedRooms = useMemo(() => {
    let filtered = rooms;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(room => {
        const otherUser = getOtherUser(room);
        const userName = `${otherUser?.profile?.firstName || ''} ${otherUser?.profile?.lastName || ''}`.toLowerCase();
        const bookingAddress = room.booking.address.toLowerCase();
        const lastMessage = room.lastMessage?.content.toLowerCase() || '';
        
        return userName.includes(searchQuery.toLowerCase()) ||
               bookingAddress.includes(searchQuery.toLowerCase()) ||
               lastMessage.includes(searchQuery.toLowerCase());
      });
    }

    // Apply status filter
    switch (filterBy) {
      case 'unread':
        filtered = filtered.filter(room => room.unreadCount > 0);
        break;
      case 'active':
        filtered = filtered.filter(room => room.isActive && !room.isArchived);
        break;
      case 'archived':
        filtered = filtered.filter(room => room.isArchived);
        break;
      case 'priority':
        filtered = filtered.filter(room => room.priority === 'high');
        break;
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.lastMessageAt || b.booking.startTime).getTime() - 
                 new Date(a.lastMessageAt || a.booking.startTime).getTime();
        case 'unread':
          return b.unreadCount - a.unreadCount;
        case 'upcoming':
          return new Date(a.booking.startTime).getTime() - new Date(b.booking.startTime).getTime();
        case 'status':
          const statusOrder = { 'CONFIRMED': 0, 'IN_PROGRESS': 1, 'PENDING': 2, 'COMPLETED': 3 };
          return (statusOrder[a.booking.status as keyof typeof statusOrder] || 4) - 
                 (statusOrder[b.booking.status as keyof typeof statusOrder] || 4);
        case 'name':
          const aName = getOtherUser(a)?.profile?.firstName || '';
          const bName = getOtherUser(b)?.profile?.firstName || '';
          return aName.localeCompare(bName);
        default:
          return 0;
      }
    });
  }, [rooms, searchQuery, sortBy, filterBy, userType]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${Math.floor(diffInMinutes)}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    if (diffInMinutes < 10080) return `${Math.floor(diffInMinutes / 1440)}d ago`;
    return date.toLocaleDateString();
  };

  const getBookingStatus = (booking: any) => {
    const now = new Date();
    const startTime = new Date(booking.startTime);
    const endTime = new Date(booking.endTime);
    
    if (booking.status === 'COMPLETED') return { text: 'Completed', color: 'text-green-600 bg-green-50' };
    if (booking.status === 'CANCELLED') return { text: 'Cancelled', color: 'text-red-600 bg-red-50' };
    if (now >= startTime && now <= endTime) return { text: 'In Progress', color: 'text-blue-600 bg-blue-50' };
    if (now < startTime) return { text: 'Upcoming', color: 'text-orange-600 bg-orange-50' };
    return { text: 'Past', color: 'text-gray-600 bg-gray-50' };
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500';
      case 'low': return 'border-l-gray-300';
      default: return 'border-l-transparent';
    }
  };

  const toggleRoomSelection = (roomId: string) => {
    const newSelected = new Set(selectedRooms);
    if (newSelected.has(roomId)) {
      newSelected.delete(roomId);
    } else {
      newSelected.add(roomId);
    }
    setSelectedRooms(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  return (
    <div className="h-full flex flex-col min-w-0 overflow-hidden bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center">
            <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
            Messages
            {filteredAndSortedRooms.length > 0 && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                ({filteredAndSortedRooms.length})
              </span>
            )}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-1.5 rounded-lg transition ${showFilters ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <FunnelIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="recent">Most Recent</option>
                <option value="unread">Unread First</option>
                <option value="upcoming">Upcoming Bookings</option>
                <option value="status">Booking Status</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filter by</label>
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterBy)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="all">All Conversations</option>
                <option value="unread">Unread Only</option>
                <option value="active">Active Bookings</option>
                <option value="archived">Archived</option>
                <option value="priority">High Priority</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex space-x-3 text-xs">
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></div>
            <span className="text-gray-600 dark:text-gray-400">
              {rooms.filter(r => r.unreadCount > 0).length} unread
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></div>
            <span className="text-gray-600 dark:text-gray-400">
              {rooms.filter(r => r.isActive && !r.isArchived).length} active
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-1.5"></div>
            <span className="text-gray-600 dark:text-gray-400">
              {rooms.filter(r => {
                const startTime = new Date(r.booking.startTime);
                const now = new Date();
                return startTime > now && startTime.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
              }).length} today
            </span>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {showBulkActions && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800 dark:text-blue-300">
              {selectedRooms.size} conversation{selectedRooms.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-2">
              <button className="text-sm px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                <BellSlashIcon className="h-4 w-4 inline mr-1" />
                Mute
              </button>
              <button className="text-sm px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
                <ArchiveBoxIcon className="h-4 w-4 inline mr-1" />
                Archive
              </button>
              <button 
                onClick={() => {
                  setSelectedRooms(new Set());
                  setShowBulkActions(false);
                }}
                className="text-sm px-3 py-1 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-gray-100 dark:scrollbar-track-gray-800">
        {filteredAndSortedRooms.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg font-medium mb-2 text-gray-700 dark:text-gray-300">No conversations found</p>
            <p className="text-sm">
              {searchQuery ? 'Try adjusting your search or filters' : 'New conversations will appear here'}
            </p>
          </div>
        ) : (
          filteredAndSortedRooms.map((room) => {
            const otherUser = getOtherUser(room);
            const userName = `${otherUser?.profile?.firstName || ''} ${otherUser?.profile?.lastName || ''}`.trim() || 'Unknown User';
            const bookingStatus = getBookingStatus(room.booking);
            const isSelected = selectedRooms.has(room.id);
            
            return (
              <div
                key={room.id}
                className={`relative border-l-4 ${getPriorityColor(room.priority)} ${
                  selectedRoom === room.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                } ${room.isArchived ? 'opacity-60' : ''} transition cursor-pointer`}
              >
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start space-x-2.5">
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRoomSelection(room.id)}
                      className="mt-1 rounded text-blue-600 dark:text-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                      onClick={(e) => e.stopPropagation()}
                    />

                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                        {otherUser?.profile?.avatar ? (
                          <img
                            src={otherUser.profile.avatar}
                            alt={userName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UserIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                        )}
                      </div>
                      {room.unreadCount > 0 && (
                        <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                          <span className="text-xs text-white font-medium">
                            {room.unreadCount > 9 ? '9+' : room.unreadCount}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Main Content */}
                    <div 
                      className="flex-1 min-w-0 overflow-hidden"
                      onClick={() => onRoomSelect(room.id)}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                            {userName}
                          </h4>
                          <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${bookingStatus.color}`}>
                            {bookingStatus.text}
                          </span>
                          {room.isMuted && <BellSlashIcon className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center space-x-1">
                          {room.priority === 'high' && (
                            <StarIcon className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                          )}
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(room.lastMessageAt || room.booking.startTime)}
                          </span>
                        </div>
                      </div>

                      {/* Booking Info */}
                      <div className="flex items-center text-xs text-gray-600 dark:text-gray-400 mb-1.5 space-x-2 overflow-hidden">
                        <div className="flex items-center whitespace-nowrap">
                          <CalendarIcon className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
                          {new Date(room.booking.startTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex items-center whitespace-nowrap">
                          <ClockIcon className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
                          {new Date(room.booking.startTime).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                        <div className="flex items-center whitespace-nowrap">
                          <UserIcon className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
                          {room.booking.childrenCount}
                        </div>
                      </div>

                      {/* Last Message */}
                      {room.lastMessage && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          <span className="font-medium">
                            {room.lastMessage.sender.id === userId ? 'You' : userName.split(' ')[0]}:
                          </span>{' '}
                          {room.lastMessage.content}
                        </p>
                      )}

                      {/* Location */}
                      <div className="flex items-center mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        <MapPinIcon className="h-2.5 w-2.5 mr-0.5" />
                        <span className="truncate">{room.booking.address.split(',')[0]}</span>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex flex-col space-y-1">
                      <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition">
                        <PhoneIcon className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-green-600 dark:hover:text-green-400 transition">
                        <VideoCameraIcon className="h-4 w-4" />
                      </button>
                      <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition">
                        <EllipsisVerticalIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}