"use client";

import React, { useState, useEffect, useRef } from 'react';
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
  ArchiveBoxIcon,
  FlagIcon,
  PaperAirplaneIcon,
  BellAlertIcon,
  SignalIcon
} from '@heroicons/react/24/outline';
import { io, Socket } from 'socket.io-client';
import { addCSRFHeader } from '@/lib/csrf';

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

interface OnlineUser {
  odUserId: string;
  userType: string;
}

interface LiveMessage {
  roomId: string;
  message: {
    id: string;
    content: string;
    sender: {
      id: string;
      name: string;
      userType: string;
    };
    createdAt: string;
  };
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // WebSocket state
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [newMessageRooms, setNewMessageRooms] = useState<Set<string>>(new Set());

  // Admin notice modal state
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeTargetRoom, setNoticeTargetRoom] = useState<string | null>(null);

  // Flag modal state
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [flagTargetRoom, setFlagTargetRoom] = useState<string | null>(null);

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
        setLastUpdated(new Date());
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
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
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
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
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
        headers: addCSRFHeader({
          'Content-Type': 'application/json',
        }),
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

  // WebSocket connection for real-time monitoring
  useEffect(() => {
    if (!adminUserId) return;

    // Initialize socket connection
    const socket = io({
      path: '/api/socket',
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Admin connected to WebSocket');
      setIsConnected(true);

      // Join admin room for monitoring
      socket.emit('admin_join', { adminId: adminUserId });
    });

    socket.on('disconnect', () => {
      console.log('🔌 Admin disconnected from WebSocket');
      setIsConnected(false);
    });

    // Listen for online/offline status
    socket.on('user_online', ({ userId, userType }: { userId: string; userType: string }) => {
      setOnlineUsers(prev => {
        const newMap = new Map(prev);
        newMap.set(userId, { odUserId: userId, userType });
        return newMap;
      });
    });

    socket.on('user_offline', ({ userId }: { userId: string }) => {
      setOnlineUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(userId);
        return newMap;
      });
    });

    // Listen for new messages across all rooms
    socket.on('new_message', (data: LiveMessage) => {
      console.log('📨 New message in room:', data.roomId);

      // Add to live messages feed
      setLiveMessages(prev => [data, ...prev].slice(0, 50));

      // Mark room as having new messages
      setNewMessageRooms(prev => {
        const newSet = new Set(prev);
        newSet.add(data.roomId);
        return newSet;
      });

      // If this is the currently selected room, refresh it
      if (selectedChatRoom?.id === data.roomId) {
        fetchChatDetails(data.roomId);
      }
    });

    // Listen for room status changes
    socket.on('room_status_changed', ({ roomId, isActive }: { roomId: string; isActive: boolean }) => {
      console.log(`🔄 Room ${roomId} status changed to ${isActive ? 'active' : 'inactive'}`);
      fetchOverview();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [adminUserId]);

  // Monitor selected room for real-time updates
  useEffect(() => {
    if (!socketRef.current || !selectedChatRoom) return;

    // Join the selected room for monitoring
    socketRef.current.emit('admin_monitor_room', {
      roomId: selectedChatRoom.id,
      adminId: adminUserId
    });

    // Clear new message indicator for this room
    setNewMessageRooms(prev => {
      const newSet = new Set(prev);
      newSet.delete(selectedChatRoom.id);
      return newSet;
    });
  }, [selectedChatRoom, adminUserId]);

  // Send admin notice to chat room
  const sendAdminNotice = async () => {
    if (!noticeTargetRoom || !noticeContent.trim()) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/chat/${noticeTargetRoom}/notice?adminUserId=${adminUserId}`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          content: noticeContent,
          type: 'admin_notice'
        }),
      });

      if (response.ok) {
        // Log the action
        await logModerationAction(noticeTargetRoom, 'admin_notice', noticeContent);

        // Refresh the chat details
        if (selectedChatRoom?.id === noticeTargetRoom) {
          await fetchChatDetails(noticeTargetRoom);
        }

        setShowNoticeModal(false);
        setNoticeContent('');
        setNoticeTargetRoom(null);
        alert('Admin notice sent successfully');
      } else {
        throw new Error('Failed to send notice');
      }
    } catch (error) {
      console.error('Error sending admin notice:', error);
      alert('Failed to send admin notice');
    } finally {
      setActionLoading(false);
    }
  };

  // Flag chat room for review
  const flagChatRoom = async () => {
    if (!flagTargetRoom) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/chat/${flagTargetRoom}/flag?adminUserId=${adminUserId}`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          reason: flagReason || 'Flagged for review',
          flaggedBy: adminUserId
        }),
      });

      if (response.ok) {
        // Log the action
        await logModerationAction(flagTargetRoom, 'flag', flagReason || 'Flagged for review');

        await fetchOverview();
        setShowFlagModal(false);
        setFlagReason('');
        setFlagTargetRoom(null);
        alert('Chat room flagged for review');
      } else {
        throw new Error('Failed to flag room');
      }
    } catch (error) {
      console.error('Error flagging chat room:', error);
      alert('Failed to flag chat room');
    } finally {
      setActionLoading(false);
    }
  };

  // Check if a user is online
  const isUserOnline = (userId: string): boolean => {
    return onlineUsers.has(userId);
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

  // Auto-refresh polling removed - WebSocket provides real-time updates
  // The WebSocket connection handles live message updates and room status changes

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
          <div className="flex items-center space-x-3">
            <h2 className="text-xl font-bold text-gray-900">Chat Management</h2>
            {/* WebSocket Connection Status */}
            <div className={`flex items-center space-x-1.5 px-2 py-1 rounded-full text-xs font-medium ${
              isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <SignalIcon className="h-3 w-3" />
              <span>{isConnected ? 'Live' : 'Offline'}</span>
            </div>
          </div>
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
              {onlineUsers.size > 0 && (
                <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-medium">
                  <span className="font-bold">{onlineUsers.size}</span> Online
                </div>
              )}
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
            <div className="flex flex-col items-end">
              <button
                onClick={fetchOverview}
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm transition"
                title="Refresh Data"
              >
                ↻ Refresh
              </button>
              {lastUpdated && (
                <span className="text-xs text-gray-500 mt-1">
                  Updated {new Date().getTime() - lastUpdated.getTime() < 60000
                    ? 'just now'
                    : `${Math.floor((new Date().getTime() - lastUpdated.getTime()) / 60000)}m ago`}
                </span>
              )}
            </div>
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
                    className={`p-3 transition cursor-pointer relative ${
                      viewMode === 'grid' ? 'border rounded-lg hover:shadow-md bg-white m-2' : 'hover:bg-blue-50'
                    } ${selectedChatRoom?.id === room.id ? 'bg-blue-50 border-blue-200' : ''} ${
                      newMessageRooms.has(room.id) ? 'ring-2 ring-blue-400 ring-opacity-50' : ''
                    }`}
                    onClick={() => fetchChatDetails(room.id)}
                  >
                    {/* New message indicator */}
                    {newMessageRooms.has(room.id) && (
                      <div className="absolute top-2 right-2 h-2.5 w-2.5 bg-blue-500 rounded-full animate-pulse" title="New messages" />
                    )}
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
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{selectedChatRoom.participants.parent.name}</span>
                        {isUserOnline(selectedChatRoom.participants.parent.id) ? (
                          <span className="flex items-center text-xs text-green-600">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                            Online
                          </span>
                        ) : (
                          <span className="flex items-center text-xs text-gray-400">
                            <span className="w-2 h-2 bg-gray-300 rounded-full mr-1"></span>
                            Offline
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-gray-600">Caregiver:</span>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{selectedChatRoom.participants.caregiver.name}</span>
                        {isUserOnline(selectedChatRoom.participants.caregiver.id) ? (
                          <span className="flex items-center text-xs text-green-600">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                            Online
                          </span>
                        ) : (
                          <span className="flex items-center text-xs text-gray-400">
                            <span className="w-2 h-2 bg-gray-300 rounded-full mr-1"></span>
                            Offline
                          </span>
                        )}
                      </div>
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
                  <div className="grid grid-cols-2 gap-2">
                    {selectedChatRoom.chatMetadata.isActive ? (
                      <button
                        onClick={() => performAction(selectedChatRoom.id, 'disable', 'Admin moderation')}
                        disabled={actionLoading}
                        className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-3 py-2 rounded text-sm transition flex items-center justify-center"
                      >
                        <XMarkIcon className="h-4 w-4 mr-1" />
                        {actionLoading ? '...' : 'Disable'}
                      </button>
                    ) : (
                      <button
                        onClick={() => performAction(selectedChatRoom.id, 'enable', 'Admin approval')}
                        disabled={actionLoading}
                        className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-3 py-2 rounded text-sm transition flex items-center justify-center"
                      >
                        <CheckCircleIcon className="h-4 w-4 mr-1" />
                        {actionLoading ? '...' : 'Enable'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setFlagTargetRoom(selectedChatRoom.id);
                        setShowFlagModal(true);
                      }}
                      disabled={actionLoading}
                      className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white px-3 py-2 rounded text-sm transition flex items-center justify-center"
                    >
                      <FlagIcon className="h-4 w-4 mr-1" />
                      Flag
                    </button>
                    <button
                      onClick={() => {
                        setNoticeTargetRoom(selectedChatRoom.id);
                        setShowNoticeModal(true);
                      }}
                      disabled={actionLoading}
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-3 py-2 rounded text-sm transition flex items-center justify-center"
                    >
                      <BellAlertIcon className="h-4 w-4 mr-1" />
                      Notice
                    </button>
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

      {/* Flag Chat Room Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <FlagIcon className="h-5 w-5 mr-2 text-yellow-500" />
                Flag Chat Room
              </h3>
              <button
                onClick={() => {
                  setShowFlagModal(false);
                  setFlagReason('');
                  setFlagTargetRoom(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for flagging
              </label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Enter reason for flagging this chat room..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowFlagModal(false);
                  setFlagReason('');
                  setFlagTargetRoom(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={flagChatRoom}
                disabled={actionLoading}
                className="px-4 py-2 text-sm bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white rounded-lg flex items-center"
              >
                <FlagIcon className="h-4 w-4 mr-1" />
                {actionLoading ? 'Flagging...' : 'Flag Room'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Admin Notice Modal */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <BellAlertIcon className="h-5 w-5 mr-2 text-blue-500" />
                Send Admin Notice
              </h3>
              <button
                onClick={() => {
                  setShowNoticeModal(false);
                  setNoticeContent('');
                  setNoticeTargetRoom(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notice Message
              </label>
              <textarea
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
                placeholder="Enter your message to send to both participants..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">
                This message will be visible to both participants in the chat.
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowNoticeModal(false);
                  setNoticeContent('');
                  setNoticeTargetRoom(null);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={sendAdminNotice}
                disabled={actionLoading || !noticeContent.trim()}
                className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg flex items-center"
              >
                <PaperAirplaneIcon className="h-4 w-4 mr-1" />
                {actionLoading ? 'Sending...' : 'Send Notice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminChatManagement;