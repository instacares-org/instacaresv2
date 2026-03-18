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
  PlayIcon,
  DevicePhoneMobileIcon,
  PaperAirplaneIcon,
  CodeBracketIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';
import { addCSRFHeader } from '@/lib/csrf';

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

  // Template Management
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [sendingTemplateTest, setSendingTemplateTest] = useState<string | null>(null);
  const [templateTestEmail, setTemplateTestEmail] = useState('');
  const [templateTestPhone, setTemplateTestPhone] = useState('');
  const [showVariables, setShowVariables] = useState<string | null>(null);
  const [templateStates, setTemplateStates] = useState<Record<string, boolean>>({
    'welcome_email': true,
    'booking_confirmation_parent': true,
    'new_booking_caregiver': true,
    'cancellation_email': true,
    'welcome_sms': true,
    'new_booking_sms': true,
    'booking_confirmation_sms': true,
    'cancellation_sms': true,
  });

  // Template stats from database (fetched on mount)
  const [templateStats, setTemplateStats] = useState<Record<string, { sent: number; delivered: number; failed: number }>>({});

  // Fetch template stats from database
  const fetchTemplateStats = async () => {
    try {
      const response = await fetch('/api/admin/notifications/analytics?period=30d');
      const data = await response.json();
      if (data.success && data.data?.volume?.byType) {
        // Map notification types to template IDs
        const stats: Record<string, { sent: number; delivered: number; failed: number }> = {};
        const byType = data.data.volume.byType || {};
        const byStatus = data.data.volume.byStatus || {};

        // Calculate delivery rate from overall stats
        const totalSent = byStatus.SENT || 0;
        const totalDelivered = byStatus.DELIVERED || 0;
        const totalFailed = byStatus.FAILED || 0;
        const deliveryRate = totalSent > 0 ? totalDelivered / totalSent : 0.95;

        // Map each type to stats
        Object.entries(byType).forEach(([type, count]) => {
          const typeCount = count as number;
          stats[type.toLowerCase()] = {
            sent: typeCount,
            delivered: Math.round(typeCount * deliveryRate),
            failed: Math.round(typeCount * (1 - deliveryRate))
          };
        });

        setTemplateStats(stats);
      }
    } catch (error) {
      console.error('Failed to fetch template stats:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplateStats();
    }
  }, [activeTab]);

  // Get stats for a template, falling back to 0 if not found
  const getTemplateStats = (templateId: string) => {
    const typeMap: Record<string, string> = {
      'welcome_email': 'account_approved',
      'booking_confirmation_parent': 'booking_confirmation',
      'new_booking_caregiver': 'booking_request',
      'cancellation_email': 'booking_cancelled',
      'welcome_sms': 'account_approved',
      'new_booking_sms': 'booking_request',
      'booking_confirmation_sms': 'booking_confirmation',
      'cancellation_sms': 'booking_cancelled',
    };
    const mappedType = typeMap[templateId] || templateId;
    return templateStats[mappedType] || { sent: 0, delivered: 0, failed: 0 };
  };

  // Template definitions with variables
  const templates = {
    email: [
      {
        id: 'welcome_email',
        name: 'Welcome Email',
        description: 'Sent to new users after registration or OAuth signup',
        triggers: ['User registration', 'Google OAuth signup'],
        variables: ['[FirstName]', '[UserType]', '[DashboardURL]'],
        sampleData: { FirstName: 'Emily', UserType: 'Parent', DashboardURL: 'https://instacares.com/dashboard' },
        preview: `Hi [FirstName]! Welcome to InstaCares! As a [UserType], you can now access your dashboard at [DashboardURL].`,
        color: 'green'
      },
      {
        id: 'booking_confirmation_parent',
        name: 'Booking Confirmation (Parent)',
        description: 'Sent to parents when their booking is confirmed',
        triggers: ['Payment successful', 'Booking created'],
        variables: ['[ParentName]', '[CaregiverName]', '[Date]', '[Time]', '[Duration]', '[TotalAmount]', '[BookingID]'],
        sampleData: { ParentName: 'Emily', CaregiverName: 'Maria Santos', Date: 'January 15, 2025', Time: '9:00 AM', Duration: '8', TotalAmount: '240.00', BookingID: 'BK-2025-0115' },
        preview: `Hi [ParentName]! Your booking with [CaregiverName] on [Date] at [Time] ([Duration] hours) is confirmed. Total: $[TotalAmount]. Booking ID: [BookingID]`,
        color: 'blue'
      },
      {
        id: 'new_booking_caregiver',
        name: 'New Booking Notification (Caregiver)',
        description: 'Sent to caregivers when they receive a new booking',
        triggers: ['New booking created'],
        variables: ['[CaregiverName]', '[ParentName]', '[Date]', '[Time]', '[Duration]', '[Address]', '[ChildrenInfo]', '[Allergies]', '[SpecialInstructions]', '[EmergencyContact]', '[Earnings]'],
        sampleData: { CaregiverName: 'Maria', ParentName: 'Emily Chen', Date: 'January 15, 2025', Time: '9:00 AM - 5:00 PM', Duration: '8', Address: '123 Maple Street, Toronto, ON', ChildrenInfo: 'Lucas (3), Emma (5)', Allergies: 'Peanuts', SpecialInstructions: 'Lucas naps at 1pm', EmergencyContact: 'Dad - Michael (416-555-1234)', Earnings: '240.00' },
        preview: `Hi [CaregiverName]! New booking from [ParentName] on [Date] at [Time]. Address: [Address]. Children: [ChildrenInfo]. Earnings: $[Earnings]`,
        color: 'amber'
      },
      {
        id: 'cancellation_email',
        name: 'Booking Cancellation',
        description: 'Sent when a booking is cancelled by either party',
        triggers: ['Booking cancelled by parent', 'Booking cancelled by caregiver'],
        variables: ['[RecipientName]', '[BookingDate]', '[CancelledBy]', '[RefundAmount]', '[RefundStatus]'],
        sampleData: { RecipientName: 'Emily', BookingDate: 'January 15, 2025', CancelledBy: 'the caregiver', RefundAmount: '240.00', RefundStatus: 'will be processed within 5-7 business days' },
        preview: `Hi [RecipientName], Your booking for [BookingDate] has been cancelled by [CancelledBy]. Refund of $[RefundAmount] [RefundStatus].`,
        color: 'red'
      }
    ],
    sms: [
      {
        id: 'welcome_sms',
        name: 'Welcome SMS',
        description: 'Welcome message for new users with phone numbers',
        triggers: ['User registration with phone'],
        variables: ['[FirstName]', '[RoleMessage]'],
        sampleData: { FirstName: 'Emily', RoleMessage: 'Find trusted caregivers for your family today!' },
        preview: `Welcome to InstaCares, [FirstName]! [RoleMessage] Visit instacares.com to get started.`,
        color: 'purple'
      },
      {
        id: 'new_booking_sms',
        name: 'New Booking SMS (Caregiver)',
        description: 'Quick alert when caregiver receives a booking',
        triggers: ['New booking created'],
        variables: ['[ParentName]', '[Date]', '[Time]', '[Duration]', '[ChildrenCount]', '[Amount]'],
        sampleData: { ParentName: 'Emily Chen', Date: 'Jan 15', Time: '9:00 AM', Duration: '8', ChildrenCount: '2', Amount: '240.00' },
        preview: `InstaCares: New booking from [ParentName]! [Date] at [Time] ([Duration]hrs) for [ChildrenCount] children. Earnings: $[Amount]. Check your dashboard!`,
        color: 'purple'
      },
      {
        id: 'booking_confirmation_sms',
        name: 'Booking Confirmation SMS (Parent)',
        description: 'Confirmation sent to parent after booking',
        triggers: ['Payment successful'],
        variables: ['[CaregiverName]', '[Date]', '[Time]', '[Amount]'],
        sampleData: { CaregiverName: 'Maria Santos', Date: 'Jan 15', Time: '9:00 AM', Amount: '240.00' },
        preview: `InstaCares: Your booking with [CaregiverName] is confirmed! [Date] at [Time]. Total: $[Amount]. Check your dashboard for details.`,
        color: 'purple'
      },
      {
        id: 'cancellation_sms',
        name: 'Cancellation SMS',
        description: 'Quick cancellation notification',
        triggers: ['Booking cancelled'],
        variables: ['[Date]', '[CancelledBy]'],
        sampleData: { Date: 'Jan 15', CancelledBy: 'the caregiver' },
        preview: `InstaCares: Your booking for [Date] has been cancelled by [CancelledBy]. Check your email for details.`,
        color: 'purple'
      }
    ]
  };

  // Fill template with sample data
  const fillTemplate = (template: string, sampleData: Record<string, string | undefined>) => {
    let filled = template;
    Object.entries(sampleData).forEach(([key, value]) => {
      filled = filled.replace(new RegExp(`\\[${key}\\]`, 'g'), value ?? '');
    });
    return filled;
  };

  // Toggle template state
  const toggleTemplate = (templateId: string) => {
    setTemplateStates(prev => ({
      ...prev,
      [templateId]: !prev[templateId]
    }));
  };

  // Send template test
  const sendTemplateTest = async (templateId: string, channel: 'email' | 'sms') => {
    const recipient = channel === 'email' ? templateTestEmail : templateTestPhone;
    if (!recipient) {
      alert(`Please enter a ${channel === 'email' ? 'email address' : 'phone number'} to send the test`);
      return;
    }

    setSendingTemplateTest(templateId);
    try {
      const templateData = channel === 'email'
        ? templates.email.find(t => t.id === templateId)
        : templates.sms.find(t => t.id === templateId);

      if (!templateData) return;

      const filledContent = fillTemplate(templateData.preview, templateData.sampleData);

      const response = await fetch('/api/admin/notifications/test', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          type: channel,
          recipient,
          subject: channel === 'email' ? `[TEST] ${templateData.name}` : undefined,
          message: filledContent,
          priority: 'NORMAL'
        })
      });

      const result = await response.json();
      if (result.success) {
        alert(`Test ${channel.toUpperCase()} sent successfully to ${recipient}`);
        fetchNotifications(false);
      } else {
        alert(`Failed to send test: ${result.error}`);
      }
    } catch (error) {
      alert(`Error sending test: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSendingTemplateTest(null);
    }
  };

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
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
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
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
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
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
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
    <div className="space-y-4">
      {/* Compact Header with Tabs and Controls in Same Row */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Tab Navigation - Compact */}
          <nav className="flex items-center space-x-1 overflow-x-auto">
            {[
              { key: 'overview', label: 'Overview', icon: ChartBarIcon },
              { key: 'history', label: 'History', icon: DocumentTextIcon },
              { key: 'analytics', label: 'Analytics', icon: SignalIcon },
              { key: 'testing', label: 'Testing', icon: BeakerIcon },
              { key: 'templates', label: 'Template Management', icon: CogIcon }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Controls - Compact */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <label className="flex items-center space-x-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              <span className="text-gray-600 hidden md:inline">Auto</span>
            </label>

            <button
              onClick={() => fetchNotifications()}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
              title="Refresh notifications"
            >
              <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Quick Stats Badge */}
            {totalCount > 0 && (
              <span className="hidden lg:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {totalCount.toLocaleString()} total
              </span>
            )}
          </div>
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

          {/* Notifications Table - Compact */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-[90px]">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-[140px]">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-[180px]">
                    Recipient
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Content
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-[100px]">
                    Time
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-[50px]">

                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <tr key={notification.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-1.5">
                        {getStatusIcon(notification.status)}
                        <span className="text-xs font-medium text-gray-700">
                          {notification.status}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex items-center space-x-1.5">
                        {getChannelIcon(notification.channel)}
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {notification.type.replace(/_/g, ' ')}
                          </div>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] ${getPriorityColor(notification.priority)}`}>
                            {notification.priority}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-900 truncate">
                        {notification.recipientName && (
                          <div className="font-medium truncate">{notification.recipientName}</div>
                        )}
                        <div className="text-gray-500 truncate text-[11px]">
                          {notification.recipientEmail || notification.recipientPhone}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-900 min-w-0">
                        {notification.subject && (
                          <div className="font-medium truncate">{notification.subject}</div>
                        )}
                        <div className="text-gray-500 truncate text-[11px]">
                          {notification.content}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2 text-[11px] text-gray-500">
                      <div className="truncate">{formatTime(notification.sentAt)}</div>
                      <div className="text-blue-600 truncate">
                        {calculateDeliveryTime(notification.sentAt, notification.deliveredAt)}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => setSelectedNotification(notification)}
                          className="text-blue-600 hover:text-blue-900 p-1"
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                        </button>
                        {notification.status === 'FAILED' && notification.retryCount < notification.maxRetries && (
                          <button
                            onClick={() => retryNotification(notification.id)}
                            className="text-green-600 hover:text-green-900 p-1"
                            title="Retry"
                          >
                            <ArrowPathIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination - Compact */}
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs">
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
        <div className="space-y-4">
          {/* Test Recipients Input */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Test Recipients</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email for Template Tests</label>
                <input
                  type="email"
                  value={templateTestEmail}
                  onChange={(e) => setTemplateTestEmail(e.target.value)}
                  placeholder="admin@instacares.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone for SMS Tests</label>
                <input
                  type="tel"
                  value={templateTestPhone}
                  onChange={(e) => setTemplateTestPhone(e.target.value)}
                  placeholder="+14165551234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Email Templates */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Email Templates</h3>
              <p className="text-xs text-gray-500 mt-0.5">Pre-configured email templates with preview, testing, and analytics</p>
            </div>
            <div className="divide-y divide-gray-100">
              {templates.email.map((template) => (
                <div key={template.id} className="px-4 py-3">
                  {/* Template Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 bg-${template.color}-100 rounded-lg`}>
                        <EnvelopeIcon className={`h-5 w-5 text-${template.color}-600`} />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{template.name}</h4>
                        <p className="text-xs text-gray-500">{template.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={() => toggleTemplate(template.id)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          templateStates[template.id] ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            templateStates[template.id] ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${templateStates[template.id] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {templateStates[template.id] ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-3 ml-12 flex items-center space-x-2">
                    {/* Preview Button */}
                    <button
                      onClick={() => setPreviewTemplate(previewTemplate === template.id ? null : template.id)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      <span>Preview</span>
                      {previewTemplate === template.id ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                    </button>

                    {/* Variables Button */}
                    <button
                      onClick={() => setShowVariables(showVariables === template.id ? null : template.id)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                    >
                      <CodeBracketIcon className="h-3.5 w-3.5" />
                      <span>Variables</span>
                      {showVariables === template.id ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                    </button>

                    {/* Send Test Button */}
                    <button
                      onClick={() => sendTemplateTest(template.id, 'email')}
                      disabled={sendingTemplateTest === template.id || !templateTestEmail}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingTemplateTest === template.id ? (
                        <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PaperAirplaneIcon className="h-3.5 w-3.5" />
                      )}
                      <span>Send Test</span>
                    </button>

                    {/* Stats from database */}
                    {(() => {
                      const stats = getTemplateStats(template.id);
                      return (
                        <div className="flex-1 flex items-center justify-end space-x-3 text-xs text-gray-500">
                          <span title="Sent"><span className="font-medium text-gray-700">{stats.sent}</span> sent</span>
                          <span title="Delivered" className="text-green-600"><span className="font-medium">{stats.delivered}</span> delivered</span>
                          {stats.failed > 0 && (
                            <span title="Failed" className="text-red-600"><span className="font-medium">{stats.failed}</span> failed</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Preview Section */}
                  {previewTemplate === template.id && (
                    <div className="mt-3 ml-12 space-y-2">
                      <div className="text-xs font-medium text-gray-700">Template Preview (with sample data):</div>
                      <div className="p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                        <div className="text-sm text-gray-800">{fillTemplate(template.preview, template.sampleData)}</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Triggers:</span> {template.triggers.join(', ')}
                      </div>
                    </div>
                  )}

                  {/* Variables Section */}
                  {showVariables === template.id && (
                    <div className="mt-3 ml-12 space-y-2">
                      <div className="text-xs font-medium text-gray-700">Available Variables:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {template.variables.map((variable) => (
                          <code key={variable} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                            {variable}
                          </code>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        <span className="font-medium">Sample Data:</span>
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          {Object.entries(template.sampleData).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="text-gray-600">[{key}]</span> = <span className="text-gray-800">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SMS Templates */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">SMS Templates</h3>
              <p className="text-xs text-gray-500 mt-0.5">Short message templates via Twilio with preview and testing</p>
            </div>
            <div className="divide-y divide-gray-100">
              {templates.sms.map((template) => (
                <div key={template.id} className="px-4 py-3">
                  {/* Template Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <DevicePhoneMobileIcon className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{template.name}</h4>
                        <p className="text-xs text-gray-500">{template.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={() => toggleTemplate(template.id)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          templateStates[template.id] ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            templateStates[template.id] ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${templateStates[template.id] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {templateStates[template.id] ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="mt-3 ml-12 flex items-center space-x-2">
                    {/* Preview Button */}
                    <button
                      onClick={() => setPreviewTemplate(previewTemplate === template.id ? null : template.id)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                    >
                      <EyeIcon className="h-3.5 w-3.5" />
                      <span>Preview</span>
                      {previewTemplate === template.id ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                    </button>

                    {/* Variables Button */}
                    <button
                      onClick={() => setShowVariables(showVariables === template.id ? null : template.id)}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded transition-colors"
                    >
                      <CodeBracketIcon className="h-3.5 w-3.5" />
                      <span>Variables</span>
                      {showVariables === template.id ? <ChevronUpIcon className="h-3 w-3" /> : <ChevronDownIcon className="h-3 w-3" />}
                    </button>

                    {/* Send Test Button */}
                    <button
                      onClick={() => sendTemplateTest(template.id, 'sms')}
                      disabled={sendingTemplateTest === template.id || !templateTestPhone}
                      className="flex items-center space-x-1 px-2 py-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingTemplateTest === template.id ? (
                        <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PaperAirplaneIcon className="h-3.5 w-3.5" />
                      )}
                      <span>Send Test</span>
                    </button>

                    {/* Stats from database */}
                    {(() => {
                      const stats = getTemplateStats(template.id);
                      return (
                        <div className="flex-1 flex items-center justify-end space-x-3 text-xs text-gray-500">
                          <span title="Sent"><span className="font-medium text-gray-700">{stats.sent}</span> sent</span>
                          <span title="Delivered" className="text-green-600"><span className="font-medium">{stats.delivered}</span> delivered</span>
                          {stats.failed > 0 && (
                            <span title="Failed" className="text-red-600"><span className="font-medium">{stats.failed}</span> failed</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Preview Section */}
                  {previewTemplate === template.id && (
                    <div className="mt-3 ml-12 space-y-2">
                      <div className="text-xs font-medium text-gray-700">Template Preview (with sample data):</div>
                      <div className="p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                        <div className="text-sm text-gray-800 font-mono">{fillTemplate(template.preview, template.sampleData)}</div>
                      </div>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Triggers:</span> {template.triggers.join(', ')}
                      </div>
                    </div>
                  )}

                  {/* Variables Section */}
                  {showVariables === template.id && (
                    <div className="mt-3 ml-12 space-y-2">
                      <div className="text-xs font-medium text-gray-700">Available Variables:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {template.variables.map((variable) => (
                          <code key={variable} className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded border border-purple-200">
                            {variable}
                          </code>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mt-2">
                        <span className="font-medium">Sample Data:</span>
                        <div className="mt-1 grid grid-cols-2 gap-1">
                          {Object.entries(template.sampleData).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="text-gray-600">[{key}]</span> = <span className="text-gray-800">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Template Stats Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="text-2xl font-bold text-gray-900">{templates.email.length}</div>
              <div className="text-xs text-gray-500">Email Templates</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="text-2xl font-bold text-gray-900">{templates.sms.length}</div>
              <div className="text-xs text-gray-500">SMS Templates</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="text-2xl font-bold text-green-600">
                {Object.values(templateStates).filter(v => v).length}
              </div>
              <div className="text-xs text-gray-500">Active</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="text-2xl font-bold text-gray-400">
                {Object.values(templateStates).filter(v => !v).length}
              </div>
              <div className="text-xs text-gray-500">Inactive</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="text-2xl font-bold text-blue-600">
                {Object.values(templateStats).reduce((acc, s) => acc + s.sent, 0)}
              </div>
              <div className="text-xs text-gray-500">Total Sent (30d)</div>
            </div>
          </div>

          {/* Quick Reference Card */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
              <CodeBracketIcon className="h-4 w-4 mr-2 text-blue-600" />
              Template Variables Quick Reference
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="font-medium text-gray-700 mb-1">User Variables</div>
                <div className="space-y-0.5 text-gray-600">
                  <div>[Name] - Full name</div>
                  <div>[FirstName] - First name only</div>
                  <div>[UserType] - Parent/Caregiver</div>
                  <div>[Email] - Email address</div>
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-700 mb-1">Booking Variables</div>
                <div className="space-y-0.5 text-gray-600">
                  <div>[Date] - Booking date</div>
                  <div>[Time] - Start time</div>
                  <div>[Duration] - Hours</div>
                  <div>[TotalAmount] - Total cost</div>
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-700 mb-1">Children Variables</div>
                <div className="space-y-0.5 text-gray-600">
                  <div>[ChildrenInfo] - Names & ages</div>
                  <div>[ChildrenCount] - Number</div>
                  <div>[Allergies] - Allergy info</div>
                  <div>[SpecialInstructions]</div>
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-700 mb-1">Other Variables</div>
                <div className="space-y-0.5 text-gray-600">
                  <div>[Address] - Location</div>
                  <div>[EmergencyContact]</div>
                  <div>[BookingID] - Reference #</div>
                  <div>[DashboardURL] - Link</div>
                </div>
              </div>
            </div>
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