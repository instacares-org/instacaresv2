"use client";

import React, { useState, useEffect } from 'react';
import {
  ChatBubbleLeftRightIcon,
  EyeIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  UserGroupIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  Squares2X2Icon,
  ListBulletIcon,
  TrashIcon,
  ArchiveBoxIcon
} from '@heroicons/react/24/outline';

interface ChatOverview {
  statistics: {
    totalChatRooms: number;
    activeChatRooms: number;
    totalMessages: number;
    messagesLast24h: number;
    flaggedChats: number;
    activeRate: number;
  };
  recentActivity: ChatRoomSummary[];
}

interface ChatRoomSummary {
  id: string;
  bookingId: string;
  parentName: string;
  caregiverName: string;
  messageCount: number;
  lastActivity: string | null;
  isActive: boolean;
  bookingStatus: string;
}

interface ChatRoomDetails {
  id: string;
  booking: {
    id: string;
    status: string;
    startTime: string;
    endTime: string;
    totalAmount: number;
    address: string;
  };
  participants: {
    parent: {
      id: string;
      name: string;
      email: string;
      phone?: string;
    };
    caregiver: {
      id: string;
      name: string;
      email: string;
      phone?: string;
    };
  };
  chatMetadata: {
    isActive: boolean;
    createdAt: string;
    lastMessageAt: string | null;
    messageCount: number;
  };
  messages: Array<{
    id: string;
    content: string;
    messageType: string;
    sender: {
      id: string;
      name: string;
      userType: string;
    };
    createdAt: string;
    isRead: boolean;
  }>;
}

interface AdminChatManagementProps {
  adminUserId: string;
}

interface ChatFilters {
  search: string;
  status: 'all' | 'active' | 'inactive';
  bookingStatus: 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';
  messageCount: 'all' | 'high' | 'medium' | 'low' | 'none';
  dateRange: 'all' | 'today' | 'week' | 'month' | 'quarter';
  participants: string;
}

function AdminChatManagement({ adminUserId }: AdminChatManagementProps) {
  const [overview, setOverview] = useState<ChatOverview | null>(null);
  const [selectedChatRoom, setSelectedChatRoom] = useState<ChatRoomDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [filteredRooms, setFilteredRooms] = useState<ChatRoomSummary[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Enhanced filtering state
  const [filters, setFilters] = useState<ChatFilters>({
    search: '',
    status: 'all',
    bookingStatus: 'all',
    messageCount: 'all',
    dateRange: 'all',
    participants: ''
  });

  // Fetch chat overview with filters
  const fetchOverview = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        adminUserId,
        search: filters.search,
        status: filters.status,
        bookingStatus: filters.bookingStatus,
        messageCount: filters.messageCount,
        dateRange: filters.dateRange,
        participants: filters.participants,
        limit: '50',
        offset: '0'
      });

      const response = await fetch(`/api/admin/chat/overview?${params}`);
      if (response.ok) {
        const data = await response.json();
        setOverview(data);
      } else {
        console.error('Failed to fetch chat overview:', response.status);
      }
    } catch (error) {
      console.error('Error fetching chat overview:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed chat room info
  const fetchChatDetails = async (roomId: string) => {
    try {
      const response = await fetch(`/api/admin/chat/${roomId}?adminUserId=${adminUserId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedChatRoom(data);
      }
    } catch (error) {
      console.error('Error fetching chat details:', error);
    }
  };

  // Perform admin action
  const performAction = async (roomId: string, action: 'disable' | 'enable', reason?: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/chat/${roomId}?adminUserId=${adminUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });

      if (response.ok) {
        // Log the moderation action
        await logModerationAction(roomId, action, reason);
        
        await fetchOverview();
        if (selectedChatRoom) {
          await fetchChatDetails(selectedChatRoom.id);
        }
      }
    } catch (error) {
      console.error('Error performing admin action:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Log moderation actions
  const logModerationAction = async (roomId: string, action: string, reason?: string) => {
    try {
      await fetch(`/api/admin/chat/logs?adminUserId=${adminUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          action,
          reason,
          metadata: {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          }
        }),
      });
    } catch (error) {
      console.error('Error logging moderation action:', error);
      // Don't fail the main action if logging fails
    }
  };

  // Bulk operations
  const handleBulkAction = async (action: 'enable' | 'disable' | 'archive' | 'export') => {
    if (selectedRooms.size === 0) {
      alert('Please select chat rooms first');
      return;
    }

    const confirmed = confirm(`Are you sure you want to ${action} ${selectedRooms.size} chat room(s)?`);
    if (!confirmed) return;

    setActionLoading(true);
    try {
      const roomIds = Array.from(selectedRooms);
      const response = await fetch(`/api/admin/chat/bulk?adminUserId=${adminUserId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          roomIds,
          reason: `Bulk ${action} operation by admin`
        })
      });

      if (response.ok) {
        const result = await response.json();
        const { results } = result;
        
        if (results.failed.length > 0) {
          console.warn('Some operations failed:', results.failed);
          alert(`${action} completed with ${results.successful.length} successful and ${results.failed.length} failed operations.`);
        } else {
          alert(`Successfully ${action}d ${results.successful.length} chat room(s).`);
        }
        
        setSelectedRooms(new Set());
        await fetchOverview();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to ${action} chat rooms`);
      }
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
      alert(`Failed to ${action} chat rooms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Selection handlers
  const handleSelectRoom = (roomId: string, checked: boolean) => {
    const newSelected = new Set(selectedRooms);
    if (checked) {
      newSelected.add(roomId);
    } else {
      newSelected.delete(roomId);
    }
    setSelectedRooms(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allRoomIds = new Set(filteredRooms.map(room => room.id));
      setSelectedRooms(allRoomIds);
    } else {
      setSelectedRooms(new Set());
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [adminUserId]);

  // Refetch when filters change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (adminUserId) {
        fetchOverview();
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [filters, adminUserId]);

  // Set filtered rooms directly from API response
  useEffect(() => {
    if (overview?.recentActivity) {
      setFilteredRooms(overview.recentActivity);
    }
  }, [overview]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Show loading spinner while fetching data
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Compact Header with Inline Stats */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-6">
          <h2 className="text-xl font-bold text-gray-900">Chat Management</h2>
          {overview && (
            <div className="flex items-center space-x-4 text-sm">
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                <span className="font-bold">{overview.statistics.totalChatRooms}</span> Total
              </div>
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                <span className="font-bold">{overview.statistics.activeRate}%</span> Active
              </div>
              <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-medium">
                <span className="font-bold">{overview.statistics.messagesLast24h}</span> Msgs/24h
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {/* Compact Search Bar */}
          <div className="relative">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Quick search..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {selectedRooms.size > 0 && (
            <div className="flex items-center space-x-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
              <span className="text-sm font-medium text-blue-700">
                {selectedRooms.size} selected
              </span>
              <div className="flex space-x-1">
                <button
                  onClick={() => handleBulkAction('enable')}
                  disabled={actionLoading}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-2 py-1 rounded text-xs transition"
                  title="Enable Selected"
                >
                  ✓
                </button>
                <button
                  onClick={() => handleBulkAction('disable')}
                  disabled={actionLoading}
                  className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-2 py-1 rounded text-xs transition"
                  title="Disable Selected"
                >
                  ✕
                </button>
                <button
                  onClick={() => handleBulkAction('export')}
                  disabled={actionLoading}
                  className="bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white px-2 py-1 rounded text-xs transition"
                  title="Export Selected"
                >
                  ↓
                </button>
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              className="p-2 text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              title={viewMode === 'list' ? 'Grid View' : 'List View'}
            >
              {viewMode === 'list' ? <Squares2X2Icon className="h-4 w-4" /> : <ListBulletIcon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-3 py-2 border rounded-lg text-sm transition ${
                showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FunnelIcon className="h-4 w-4 mr-1" />
              Filters
            </button>
            <button
              onClick={fetchOverview}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm transition"
              title="Refresh Data"
            >
              ↻
            </button>
          </div>
        </div>
      </div>

      {/* Compact Filter Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search participants, booking ID..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Chat Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            {/* Booking Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Booking Status</label>
              <select
                value={filters.bookingStatus}
                onChange={(e) => setFilters(prev => ({ ...prev, bookingStatus: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Bookings</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Message Count Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message Volume</label>
              <select
                value={filters.messageCount}
                onChange={(e) => setFilters(prev => ({ ...prev, messageCount: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Volumes</option>
                <option value="high">High (50+ messages)</option>
                <option value="medium">Medium (10-49 messages)</option>
                <option value="low">Low (1-9 messages)</option>
                <option value="none">No messages</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Activity Period</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
            </div>

            {/* Participants Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Participants</label>
              <input
                type="text"
                placeholder="Search by participant name..."
                value={filters.participants}
                onChange={(e) => setFilters(prev => ({ ...prev, participants: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t col-span-full">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{filteredRooms.length}</span> of <span className="font-medium">{overview?.recentActivity.length || 0}</span> chat rooms
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setFilters({
                  search: '',
                  status: 'all',
                  bookingStatus: 'all',
                  messageCount: 'all',
                  dateRange: 'all',
                  participants: ''
                })}
                className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition"
              >
                Clear
              </button>
              <button
                onClick={() => handleBulkAction('export')}
                className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition flex items-center"
              >
                <ArrowDownTrayIcon className="h-3 w-3 mr-1" />
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Split Panel Layout */}
      <div className="flex-1 flex overflow-hidden space-x-4 p-4">
        {/* Left Panel - Chat Rooms List */}
        <div className="w-1/2 bg-white rounded-lg shadow-sm border flex flex-col">
          <div className="p-3 border-b bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Chat Rooms</h3>
              <div className="flex items-center space-x-2">
                {filteredRooms.length > 0 && (
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedRooms.size === filteredRooms.length && filteredRooms.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span>Select All</span>
                  </label>
                )}
                <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded-full border">
                  {filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden">
            <div className={`h-full overflow-y-auto ${viewMode === 'grid' ? 'grid grid-cols-1 gap-2 p-3' : 'divide-y divide-gray-100'}`}>
              {filteredRooms.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <ChatBubbleLeftRightIcon className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No chat rooms match your filters</p>
                  <button
                    onClick={() => setFilters({
                      search: '',
                      status: 'all',
                      bookingStatus: 'all',
                      messageCount: 'all',
                      dateRange: 'all',
                      participants: ''
                    })}
                    className="mt-2 text-blue-500 hover:text-blue-700 text-sm"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                filteredRooms.map((room) => (
                  <div
                    key={room.id}
                    className={`p-3 transition cursor-pointer ${
                      viewMode === 'grid' ? 'border rounded-lg hover:shadow-md bg-white m-2' : 'hover:bg-blue-50'
                    } ${selectedChatRoom?.id === room.id ? 'bg-blue-50 border-blue-200' : ''}`}
                    onClick={() => fetchChatDetails(room.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedRooms.has(room.id)}
                        onChange={(e) => handleSelectRoom(room.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-1 text-sm font-medium text-gray-900 truncate">
                            <span className="truncate">{room.parentName}</span>
                            <span className="text-gray-400 text-xs">↔</span>
                            <span className="truncate">{room.caregiverName}</span>
                          </div>
                          <div className="flex items-center space-x-1 ml-2">
                            {room.isActive ? (
                              <CheckCircleIcon className="h-4 w-4 text-green-500" title="Active" />
                            ) : (
                              <XMarkIcon className="h-4 w-4 text-red-500" title="Inactive" />
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            room.messageCount > 50 ? 'bg-red-100 text-red-700' :
                            room.messageCount > 10 ? 'bg-yellow-100 text-yellow-700' :
                            room.messageCount > 0 ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {room.messageCount} msg{room.messageCount !== 1 ? 's' : ''}
                          </span>
                          
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            room.bookingStatus === 'completed' ? 'bg-green-100 text-green-700' :
                            room.bookingStatus === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                            room.bookingStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {room.bookingStatus}
                          </span>
                        </div>
                        
                        <div className="text-xs text-gray-500 truncate">
                          ID: {room.bookingId.slice(-8)}
                          {room.lastActivity && (
                            <span className="ml-2">
                              {new Date(room.lastActivity).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Chat Room Details */}
        <div className="w-1/2 bg-white rounded-lg shadow-sm border flex flex-col">
          <div className="p-3 border-b bg-gray-50 rounded-t-lg">
            <h3 className="text-lg font-semibold text-gray-900">Chat Details</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {selectedChatRoom ? (
              <div className="space-y-4">
                {/* Quick Info Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="text-xs text-blue-600 font-medium mb-1">Messages</div>
                    <div className="text-lg font-bold text-blue-900">{selectedChatRoom.chatMetadata.messageCount}</div>
                  </div>
                  <div className={`p-3 rounded-lg border ${selectedChatRoom.chatMetadata.isActive ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className={`text-xs font-medium mb-1 ${selectedChatRoom.chatMetadata.isActive ? 'text-green-600' : 'text-red-600'}`}>Status</div>
                    <div className={`text-lg font-bold ${selectedChatRoom.chatMetadata.isActive ? 'text-green-900' : 'text-red-900'}`}>
                      {selectedChatRoom.chatMetadata.isActive ? 'Active' : 'Disabled'}
                    </div>
                  </div>
                </div>

                {/* Participants */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <UserGroupIcon className="h-4 w-4 mr-2" />
                    Participants
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-600">Parent:</span>
                      <span className="font-medium text-gray-900">{selectedChatRoom.participants.parent.name}</span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-600">Caregiver:</span>
                      <span className="font-medium text-gray-900">{selectedChatRoom.participants.caregiver.name}</span>
                    </div>
                  </div>
                </div>

                {/* Booking Summary */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Booking Info
                  </h4>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                        selectedChatRoom.booking.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        selectedChatRoom.booking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                        selectedChatRoom.booking.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {selectedChatRoom.booking.status}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-medium text-gray-900">{formatCurrency(selectedChatRoom.booking.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium text-gray-900">{new Date(selectedChatRoom.booking.startTime).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Admin Actions */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 mb-3">Admin Actions</h4>
                  <div className="flex space-x-2">
                    {selectedChatRoom.chatMetadata.isActive ? (
                      <button
                        onClick={() => performAction(selectedChatRoom.id, 'disable', 'Admin moderation')}
                        disabled={actionLoading}
                        className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-3 py-2 rounded text-sm transition flex items-center justify-center"
                      >
                        <XMarkIcon className="h-4 w-4 mr-1" />
                        {actionLoading ? 'Processing...' : 'Disable'}
                      </button>
                    ) : (
                      <button
                        onClick={() => performAction(selectedChatRoom.id, 'enable', 'Admin approval')}
                        disabled={actionLoading}
                        className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-3 py-2 rounded text-sm transition flex items-center justify-center"
                      >
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        {actionLoading ? 'Processing...' : 'Enable'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Recent Messages Preview */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <ChatBubbleLeftRightIcon className="h-4 w-4 mr-2" />
                    Recent Messages
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-3">
                    {selectedChatRoom.messages.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No messages in this chat</p>
                    ) : (
                      selectedChatRoom.messages.slice(-5).reverse().map((message) => (
                        <div key={message.id} className="bg-white p-2 rounded border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-900">
                              {message.sender.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(message.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{message.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <ChatBubbleLeftRightIcon className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium mb-2">Select a chat room</p>
                <p className="text-sm">Choose a chat room from the list to view detailed information and manage conversations.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminChatManagement;