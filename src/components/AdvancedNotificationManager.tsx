"use client";

import React, { useState, useEffect } from 'react';
import {
  BellIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ClockIcon,
  ArrowPathIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  SignalIcon,
  ExclamationCircleIcon,
  ChartBarIcon,
  EyeIcon,
  DocumentTextIcon,
  CogIcon,
  BeakerIcon,
  PlayIcon
} from '@heroicons/react/24/outline';

interface NotificationEvent {
  id: string;
  type: string;
  channel: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  templateId: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName?: string;
  subject?: string;
  content: string;
  status: 'PENDING' | 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  deliveryStatus?: 'DELIVERED' | 'FAILED' | 'BOUNCED' | 'SPAM' | 'UNSUBSCRIBED' | 'OPENED' | 'CLICKED';
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  retries: NotificationRetry[];
  webhooks: NotificationWebhook[];
  createdAt: string;
}

interface NotificationRetry {
  id: string;
  attemptNumber: number;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  attemptedAt: string;
}

interface NotificationWebhook {
  id: string;
  provider: string;
  eventType: string;
  processed: boolean;
  receivedAt: string;
}

interface NotificationAnalytics {
  volume: {
    total: number;
    byStatus: Record<string, number>;
    byChannel: Record<string, number>;
    byType: Record<string, number>;
  };
  deliveryMetrics: {
    successRate: {
      overall: string;
      byChannel: Record<string, string>;
    };
    averageDeliveryTime: Record<string, any>;
  };
  criticalAlerts: {
    totalFailed: number;
  };
  compliance: {
    unsubscribeRate: number;
    bounceRate: number;
    spamReports: number;
  };
}

const AdvancedNotificationManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'analytics' | 'templates' | 'testing'>('overview');
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [analytics, setAnalytics] = useState<NotificationAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<NotificationEvent | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('24h');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Refresh interval for real-time updates
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Testing functionality
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testSubject, setTestSubject] = useState('');
  const [testPriority, setTestPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL'>('NORMAL');
  const [testingInProgress, setTestingInProgress] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);

  useEffect(() => {
    fetchNotifications();
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, currentPage, statusFilter, channelFilter, priorityFilter, searchTerm, dateRange]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchNotifications(false);
      if (activeTab === 'analytics') {
        fetchAnalytics();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, currentPage, statusFilter, channelFilter, priorityFilter, searchTerm, dateRange]);

  const fetchNotifications = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      });
      
      if (statusFilter) params.append('status', statusFilter);
      if (channelFilter) params.append('channel', channelFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (searchTerm) params.append('recipient', searchTerm);

      const response = await fetch(`/api/admin/notifications?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.data.notifications);
        setTotalPages(data.data.pagination.totalPages);
        setTotalCount(data.data.pagination.totalCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const params = new URLSearchParams({
        period: dateRange
      });
      if (channelFilter) params.append('channel', channelFilter);

      const response = await fetch(`/api/admin/notifications/analytics?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setAnalytics(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const retryNotification = async (notificationId: string) => {
    try {
      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationId,
          action: 'retry'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        fetchNotifications(false);
      }
    } catch (error) {
      console.error('Failed to retry notification:', error);
    }
  };

  // Testing functions
  const sendTestEmail = async () => {
    if (!testEmail || !testMessage) {
      alert('Please provide email and message');
      return;
    }
    
    setTestingInProgress(true);
    try {
      const response = await fetch('/api/admin/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          recipient: testEmail,
          subject: testSubject || 'Instacares Test Email',
          message: testMessage,
          priority: testPriority
        })
      });
      
      const result = await response.json();
      setTestResults(prev => [...prev, {
        type: 'Email',
        timestamp: new Date().toLocaleString(),
        recipient: testEmail,
        success: result.success,
        message: result.success ? 'Email sent successfully' : result.error,
        notificationId: result.notificationId
      }]);
      
      if (result.success) {
        fetchNotifications(false);
      }
    } catch (error) {
      setTestResults(prev => [...prev, {
        type: 'Email',
        timestamp: new Date().toLocaleString(),
        recipient: testEmail,
        success: false,
        message: 'Failed to send test email: ' + (error instanceof Error ? error.message : 'Unknown error')
      }]);
    } finally {
      setTestingInProgress(false);
    }
  };

  const sendTestSMS = async () => {
    if (!testPhone || !testMessage) {
      alert('Please provide phone number and message');
      return;
    }
    
    setTestingInProgress(true);
    try {
      const response = await fetch('/api/admin/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sms',
          recipient: testPhone,
          message: testMessage,
          priority: testPriority
        })
      });
      
      const result = await response.json();
      setTestResults(prev => [...prev, {
        type: 'SMS',
        timestamp: new Date().toLocaleString(),
        recipient: testPhone,
        success: result.success,
        message: result.success ? 'SMS sent successfully' : result.error,
        notificationId: result.notificationId
      }]);
      
      if (result.success) {
        fetchNotifications(false);
      }
    } catch (error) {
      setTestResults(prev => [...prev, {
        type: 'SMS',
        timestamp: new Date().toLocaleString(),
        recipient: testPhone,
        success: false,
        message: 'Failed to send test SMS: ' + (error instanceof Error ? error.message : 'Unknown error')
      }]);
    } finally {
      setTestingInProgress(false);
    }
  };

  const clearTestResults = () => {
    setTestResults([]);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'SENT':
        return <CheckCircleIcon className="h-4 w-4 text-blue-500" />;
      case 'FAILED':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />;
      case 'PENDING':
      case 'QUEUED':
        return <ClockIcon className="h-4 w-4 text-yellow-500" />;
      case 'SENDING':
        return <ArrowPathIcon className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'EMAIL':
        return <EnvelopeIcon className="h-4 w-4" />;
      case 'SMS':
        return <ChatBubbleLeftRightIcon className="h-4 w-4" />;
      case 'PUSH':
        return <BellIcon className="h-4 w-4" />;
      default:
        return <SignalIcon className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'NORMAL':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'LOW':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const calculateDeliveryTime = (sentAt?: string, deliveredAt?: string) => {
    if (!sentAt || !deliveredAt) return 'N/A';
    const sent = new Date(sentAt).getTime();
    const delivered = new Date(deliveredAt).getTime();
    const diff = delivered - sent;
    return diff > 0 ? `${Math.round(diff / 1000)}s` : 'N/A';
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading notification data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                <BellIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Notification Management</h2>
                <p className="text-sm text-gray-600">Monitor and manage all system notifications with legal compliance</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Auto-refresh</span>
              </label>
              
              <button
                onClick={() => fetchNotifications()}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <ArrowPathIcon className="h-4 w-4" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="px-4 py-3 bg-gray-50">
          <nav className="flex space-x-1">
            {[
              { key: 'overview', label: 'Overview', icon: ChartBarIcon },
              { key: 'history', label: 'History', icon: DocumentTextIcon },
              { key: 'analytics', label: 'Analytics', icon: SignalIcon },
              { key: 'testing', label: 'Testing', icon: BeakerIcon },
              { key: 'templates', label: 'Templates', icon: CogIcon }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-blue-600 shadow-sm border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Notifications</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.volume.total.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">Last 24 hours</p>
              </div>
              <BellIcon className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">{analytics.deliveryMetrics.successRate.overall}%</p>
                <p className="text-xs text-gray-500 mt-1">Overall delivery rate</p>
              </div>
              <CheckCircleIcon className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Critical Failures</p>
                <p className="text-2xl font-bold text-red-600">{analytics.criticalAlerts.totalFailed}</p>
                <p className="text-xs text-gray-500 mt-1">High priority alerts</p>
              </div>
              <ExclamationTriangleIcon className="h-8 w-8 text-red-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliance Issues</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {analytics.compliance.bounceRate + analytics.compliance.spamReports}
                </p>
                <p className="text-xs text-gray-500 mt-1">Bounces + Spam reports</p>
              </div>
              <ExclamationCircleIcon className="h-8 w-8 text-yellow-500" />
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Email, phone, name..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="SENT">Sent</option>
                  <option value="FAILED">Failed</option>
                  <option value="PENDING">Pending</option>
                  <option value="SENDING">Sending</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Channel</label>
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Channels</option>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="PUSH">Push</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="NORMAL">Normal</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div className="md:col-span-2 flex items-end space-x-2">
                <button
                  onClick={() => {
                    setStatusFilter('');
                    setChannelFilter('');
                    setPriorityFilter('');
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Notifications Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type & Channel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recipient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delivery Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <tr key={notification.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(notification.status)}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {notification.status}
                            </div>
                            {notification.deliveryStatus && (
                              <div className="text-xs text-gray-500">
                                {notification.deliveryStatus}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {getChannelIcon(notification.channel)}
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {notification.type.replace(/_/g, ' ')}
                            </div>
                            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs border ${getPriorityColor(notification.priority)}`}>
                              {notification.priority}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {notification.recipientName && (
                            <div className="font-medium">{notification.recipientName}</div>
                          )}
                          <div className="text-gray-500">
                            {notification.recipientEmail || notification.recipientPhone}
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {notification.subject && (
                            <div className="font-medium truncate max-w-xs">{notification.subject}</div>
                          )}
                          <div className="text-gray-500 truncate max-w-xs">
                            {notification.content}
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>Sent: {formatTime(notification.sentAt)}</div>
                        <div>Delivered: {formatTime(notification.deliveredAt)}</div>
                        <div className="text-xs text-blue-600">
                          {calculateDeliveryTime(notification.sentAt, notification.deliveredAt)}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedNotification(notification)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          {notification.status === 'FAILED' && notification.retryCount < notification.maxRetries && (
                            <button
                              onClick={() => retryNotification(notification.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Retry notification"
                            >
                              <ArrowPathIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Showing {notifications.length} of {totalCount.toLocaleString()} notifications
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <span className="px-3 py-1 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Analytics controls */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Analytics & Insights</h3>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </div>
          </div>

          {/* Success rates by channel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Success Rate by Channel</h4>
              <div className="space-y-3">
                {Object.entries(analytics.deliveryMetrics.successRate.byChannel).map(([channel, rate]) => (
                  <div key={channel} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getChannelIcon(channel)}
                      <span className="text-sm font-medium text-gray-700">{channel}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{rate}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">Volume by Channel</h4>
              <div className="space-y-3">
                {Object.entries(analytics.volume.byChannel).map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getChannelIcon(channel)}
                      <span className="text-sm font-medium text-gray-700">{channel}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Compliance metrics */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Legal Compliance</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{analytics.compliance.bounceRate}</div>
                <div className="text-sm text-gray-600">Email Bounces</div>
              </div>
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{analytics.compliance.spamReports}</div>
                <div className="text-sm text-gray-600">Spam Reports</div>
              </div>
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{analytics.compliance.unsubscribeRate}</div>
                <div className="text-sm text-gray-600">Unsubscribes</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Testing Tab */}
      {activeTab === 'testing' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Notification Testing</h3>
                <p className="text-sm text-gray-600 mt-1">Test email and SMS notifications to ensure they're working correctly</p>
              </div>
              <BeakerIcon className="h-8 w-8 text-purple-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Test Form */}
              <div className="space-y-6">
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">Test Configuration</h4>
                  
                  {/* Email Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Test Email Address</label>
                    <input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="admin@instacares.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Phone Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Test Phone Number</label>
                    <input
                      type="tel"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="+1234567890"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Subject Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Email Subject (Optional)</label>
                    <input
                      type="text"
                      value={testSubject}
                      onChange={(e) => setTestSubject(e.target.value)}
                      placeholder="Instacares Test Email"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Message Input */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Test Message</label>
                    <textarea
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="This is a test notification from Instacares admin panel. If you receive this message, the notification system is working correctly."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Priority Select */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Priority Level</label>
                    <select
                      value={testPriority}
                      onChange={(e) => setTestPriority(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>

                {/* Test Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={sendTestEmail}
                    disabled={testingInProgress || !testEmail || !testMessage}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {testingInProgress ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <EnvelopeIcon className="h-4 w-4" />
                    )}
                    <span>Send Test Email</span>
                  </button>

                  <button
                    onClick={sendTestSMS}
                    disabled={testingInProgress || !testPhone || !testMessage}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {testingInProgress ? (
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChatBubbleLeftRightIcon className="h-4 w-4" />
                    )}
                    <span>Send Test SMS</span>
                  </button>
                </div>
              </div>

              {/* Test Results */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-900">Test Results</h4>
                  {testResults.length > 0 && (
                    <button
                      onClick={clearTestResults}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear Results
                    </button>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 min-h-[300px]">
                  {testResults.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <BeakerIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                      <p>No test results yet. Send a test notification to see results here.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {testResults.slice().reverse().map((result, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${
                            result.success
                              ? 'bg-green-50 border-green-200'
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              {result.success ? (
                                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                              ) : (
                                <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                              )}
                              <span className="font-medium text-sm">{result.type} Test</span>
                            </div>
                            <span className="text-xs text-gray-500">{result.timestamp}</span>
                          </div>
                          <div className="text-xs text-gray-600 mb-1">
                            <strong>Recipient:</strong> {result.recipient}
                          </div>
                          <div className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                            {result.message}
                          </div>
                          {result.notificationId && (
                            <div className="text-xs text-gray-500 mt-1">
                              <strong>Notification ID:</strong> {result.notificationId}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* System Health Check */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h4 className="text-md font-medium text-gray-900 mb-4">System Health Status</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <EnvelopeIcon className="h-5 w-5 text-blue-500" />
                  <span className="font-medium text-gray-900">Email Service</span>
                </div>
                <div className="text-sm text-gray-600">Resend integration status and last send time</div>
                <div className="mt-2 text-xs text-green-600">✓ Service enabled</div>
              </div>
              
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-gray-900">SMS Service</span>
                </div>
                <div className="text-sm text-gray-600">Twilio integration status and last send time</div>
                <div className="mt-2 text-xs text-yellow-600">⚠ Service configured (development mode)</div>
              </div>
              
              <div className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <SignalIcon className="h-5 w-5 text-purple-500" />
                  <span className="font-medium text-gray-900">Database</span>
                </div>
                <div className="text-sm text-gray-600">Notification event logging and storage</div>
                <div className="mt-2 text-xs text-green-600">✓ Connected and operational</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center py-12">
            <DocumentTextIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Template Management</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              Manage notification templates for consistent messaging across all channels.
            </p>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Coming Soon
            </button>
          </div>
        </div>
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Notification Details</h3>
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>ID:</strong> {selectedNotification.id}</div>
                    <div><strong>Type:</strong> {selectedNotification.type.replace(/_/g, ' ')}</div>
                    <div><strong>Channel:</strong> {selectedNotification.channel}</div>
                    <div><strong>Priority:</strong> {selectedNotification.priority}</div>
                    <div><strong>Status:</strong> {selectedNotification.status}</div>
                    <div><strong>Template:</strong> {selectedNotification.templateId}</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Recipient</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Name:</strong> {selectedNotification.recipientName || 'N/A'}</div>
                    <div><strong>Email:</strong> {selectedNotification.recipientEmail || 'N/A'}</div>
                    <div><strong>Phone:</strong> {selectedNotification.recipientPhone || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Content</h4>
                {selectedNotification.subject && (
                  <div className="mb-2">
                    <strong className="text-sm">Subject:</strong>
                    <div className="mt-1 p-3 bg-gray-50 rounded border text-sm">{selectedNotification.subject}</div>
                  </div>
                )}
                <div>
                  <strong className="text-sm">Message:</strong>
                  <div className="mt-1 p-3 bg-gray-50 rounded border text-sm">{selectedNotification.content}</div>
                </div>
              </div>

              {/* Timing */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Delivery Timeline</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><strong>Created:</strong> {formatTime(selectedNotification.createdAt)}</div>
                  <div><strong>Scheduled:</strong> {formatTime(selectedNotification.scheduledAt)}</div>
                  <div><strong>Sent:</strong> {formatTime(selectedNotification.sentAt)}</div>
                  <div><strong>Delivered:</strong> {formatTime(selectedNotification.deliveredAt)}</div>
                </div>
              </div>

              {/* Error Details */}
              {selectedNotification.status === 'FAILED' && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Error Details</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Error Code:</strong> {selectedNotification.errorCode || 'N/A'}</div>
                    <div><strong>Error Message:</strong> {selectedNotification.errorMessage || 'N/A'}</div>
                    <div><strong>Retry Count:</strong> {selectedNotification.retryCount} / {selectedNotification.maxRetries}</div>
                  </div>
                </div>
              )}

              {/* Retry History */}
              {selectedNotification.retries.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Retry History</h4>
                  <div className="space-y-2">
                    {selectedNotification.retries.map((retry, index) => (
                      <div key={retry.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <div>Attempt #{retry.attemptNumber} - {retry.status}</div>
                        <div>{formatTime(retry.attemptedAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Webhook Events */}
              {selectedNotification.webhooks.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Webhook Events</h4>
                  <div className="space-y-2">
                    {selectedNotification.webhooks.map((webhook, index) => (
                      <div key={webhook.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <div>{webhook.provider} - {webhook.eventType}</div>
                        <div>{formatTime(webhook.receivedAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedNotificationManager;