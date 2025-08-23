"use client";

import { useState, useEffect } from "react";
import AdminAuthLayout from '@/components/AdminAuthLayout';
import {
  UsersIcon,
  ShieldCheckIcon,
  EyeIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CogIcon,
  DocumentChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  CreditCardIcon,
  BanknotesIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  ClockIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import Image from "next/image";
import { generateStyledInvoice } from "@/components/InvoicePrintView";
import AdminChatManagement from "@/components/AdminChatManagement";
import AdminReviewList from "@/components/AdminReviewList";

interface User {
  id: string;
  name: string;
  email: string;
  type: 'caregiver' | 'parent';
  status: 'active' | 'pending' | 'suspended';
  joinDate: string;
  verified: boolean;
}

interface PendingApproval {
  id: string;
  type: 'profile' | 'photo' | 'verification';
  caregiverName: string;
  submittedDate: string;
  description: string;
}

interface PendingUser {
  id: string;
  email: string;
  userType: 'PARENT' | 'CAREGIVER' | 'ADMIN';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  createdAt: string;
  profile?: {
    firstName: string;
    lastName: string;
    phone?: string;
  };
  caregiver?: {
    hourlyRate: number;
    experienceYears: number;
    bio?: string;
  };
}

interface SupportTicket {
  id: string;
  user: string;
  subject: string;
  status: 'open' | 'in-progress' | 'closed';
  priority: 'low' | 'medium' | 'high';
  createdDate: string;
}

interface Booking {
  id: string;
  parentName: string;
  caregiverName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  childrenCount: number;
  amount: number;
  platformFee: number;
  caregiverPayout: number;
  status: 'pending' | 'completed' | 'cancelled' | 'disputed';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  createdDate: string;
  invoiceGenerated: boolean;
}

interface Invoice {
  id: string;
  bookingId: string;
  type: 'parent' | 'caregiver' | 'platform';
  amount: number;
  recipient: string;
  status: 'draft' | 'sent' | 'paid';
  generatedDate: string;
  dueDate: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [reviewFilter, setReviewFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);

  // Real data from API
  const [users, setUsers] = useState<User[]>([]);

  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  const [bookings, setBookings] = useState<Booking[]>([]);

  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [platformStats, setPlatformStats] = useState({
    totalUsers: 0,
    totalCaregivers: 0,
    totalParents: 0,
    totalAdmins: 0,
    pendingVerifications: 0,
    activeBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
    totalPlatformFees: 0,
    totalPayouts: 0,
    pendingReviews: 0,
    newUsersThisWeek: 0,
    supportTickets: 0
  });

  const approveItem = (id: string) => {
    setPendingApprovals(prev => prev.filter(item => item.id !== id));
  };

  const rejectItem = (id: string) => {
    setPendingApprovals(prev => prev.filter(item => item.id !== id));
  };

  const updateUserStatus = (userId: string, newStatus: 'active' | 'suspended') => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, status: newStatus } : user
    ));
  };

  // Fetch pending users
  const fetchPendingUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await fetch('/api/admin/users/pending', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPendingUsers(data.users);
      } else {
        console.error('Failed to fetch pending users');
      }
    } catch (error) {
      console.error('Error fetching pending users:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Handle user approval/rejection
  const handleUserApproval = async (userId: string, action: 'APPROVED' | 'REJECTED' | 'SUSPENDED', reason?: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/approval`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, reason }),
      });

      if (response.ok) {
        // Remove from pending users list
        setPendingUsers(prev => prev.filter(user => user.id !== userId));
        console.log(`User ${action.toLowerCase()} successfully`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to update user approval:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error || 'Unknown error'
        });
        alert(`Failed to ${action.toLowerCase()} user: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating user approval:', error);
    }
  };

  // Fetch dashboard data on component mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/admin/dashboard', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const result = await response.json();
          const data = result.data;
          
          // Update all state with real data
          setUsers(data.users || []);
          setBookings(data.bookings || []);
          setPendingApprovals(data.pendingApprovals || []);
          setSupportTickets(data.supportTickets || []);
          setPlatformStats(data.stats || {});
          setDashboardData(data);
        } else {
          const errorData = await response.text();
          console.error('Failed to fetch dashboard data:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData
          });
          // Set fallback data if API fails
          setPlatformStats({
            totalUsers: 0,
            totalCaregivers: 0,
            totalParents: 0,
            totalAdmins: 0,
            pendingApprovals: 0,
            activeBookings: 0,
            completedBookings: 0,
            totalRevenue: 0,
            totalPlatformFees: 0,
            totalPayouts: 0,
            pendingReviews: 0,
            newUsersThisWeek: 0,
            supportTickets: 0
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Set fallback data if API fails
        setPlatformStats({
          totalUsers: 0,
          totalCaregivers: 0,
          totalParents: 0,
          totalAdmins: 0,
          pendingApprovals: 0,
          activeBookings: 0,
          completedBookings: 0,
          totalRevenue: 0,
          totalPlatformFees: 0,
          totalPayouts: 0,
          pendingReviews: 0,
          newUsersThisWeek: 0,
          supportTickets: 0
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  // Load pending users when approvals tab is active
  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchPendingUsers();
    }
  }, [activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'suspended': return 'text-red-600 bg-red-100';
      case 'open': return 'text-red-600 bg-red-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'closed': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getBookingStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      case 'disputed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'refunded': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const generateInvoice = (bookingId: string, type: 'parent' | 'caregiver') => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const newInvoice: Invoice = {
      id: `INV-${type.charAt(0).toUpperCase()}-${Date.now()}`,
      bookingId: bookingId,
      type: type,
      amount: type === 'parent' ? booking.amount : booking.caregiverPayout,
      recipient: type === 'parent' ? booking.parentName : booking.caregiverName,
      status: 'draft',
      generatedDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    setInvoices(prev => [...prev, newInvoice]);
    
    // Update booking to mark invoice as generated
    setBookings(prev => prev.map(b => 
      b.id === bookingId ? { ...b, invoiceGenerated: true } : b
    ));
  };

  const downloadInvoice = (invoice: Invoice) => {
    const booking = bookings.find(b => b.id === invoice.bookingId);
    if (!booking) return;

    const invoiceData = {
      invoice: invoice,
      booking: booking,
      platformInfo: {
        name: 'Instacares',
        address: '123 Business St, New York, NY 10001',
        tax: 'TAX-123456789',
        phone: '(555) 123-4567',
        email: 'invoicing@instacares.com',
        website: 'www.instacares.com'
      }
    };

    // Generate beautiful styled invoice for printing/PDF
    generateStyledInvoice(invoiceData);
  };

  const StatCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <Icon className={`h-8 w-8 ${color.replace('text-', 'text-').split(' ')[0]}`} />
      </div>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <AdminAuthLayout title="Admin Dashboard" className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
              <p className="text-gray-600">Loading dashboard data...</p>
            </div>
          </div>
        </div>
      </AdminAuthLayout>
    );
  }

  return (
    <AdminAuthLayout title="Admin Dashboard" className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 overflow-x-auto">
          {[
            { key: 'overview', label: 'Overview', icon: ChartBarIcon },
            { key: 'users', label: 'Users', icon: UsersIcon },
            { key: 'payments', label: 'Payments', icon: CreditCardIcon },
            { key: 'approvals', label: 'Approvals', icon: ShieldCheckIcon },
            { key: 'moderation', label: 'Reviews', icon: EyeIcon },
            { key: 'chats', label: 'Chat Management', icon: ChatBubbleLeftRightIcon },
            { key: 'analytics', label: 'Analytics', icon: DocumentChartBarIcon },
            { key: 'support', label: 'Support', icon: ExclamationTriangleIcon },
            { key: 'settings', label: 'Settings', icon: CogIcon }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === tab.key 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Users"
                value={(platformStats.totalUsers || 0).toLocaleString()}
                subtitle="All registered users"
                icon={UsersIcon}
                color="text-blue-600"
              />
              <StatCard
                title="Caregivers"
                value={platformStats.totalCaregivers || 0}
                subtitle="Active providers"
                icon={ShieldCheckIcon}
                color="text-green-600"
              />
              <StatCard
                title="Parents"
                value={platformStats.totalParents || 0}
                subtitle="Seeking childcare"
                icon={UsersIcon}
                color="text-purple-600"
              />
              <StatCard
                title="Pending Reviews"
                value={platformStats.pendingApprovals || 0}
                subtitle="Need approval"
                icon={ExclamationTriangleIcon}
                color="text-yellow-600"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <StatCard
                title="Active Bookings"
                value={platformStats.activeBookings || 0}
                subtitle="Current month"
                icon={ChartBarIcon}
                color="text-indigo-600"
              />
              <StatCard
                title="Monthly Revenue"
                value={`$${(platformStats.totalRevenue || 0).toLocaleString()}`}
                subtitle="February 2024"
                icon={ChartBarIcon}
                color="text-green-600"
              />
              <StatCard
                title="Support Tickets"
                value={platformStats.supportTickets || 0}
                subtitle="Open tickets"
                icon={ChatBubbleLeftRightIcon}
                color="text-red-600"
              />
            </div>

            {/* Stripe Dashboard Link */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <CreditCardIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Payment Management</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      View detailed payment analytics, process refunds, and manage payouts in Stripe
                    </p>
                  </div>
                </div>
                <a
                  href="https://dashboard.stripe.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <span>Open Stripe Dashboard</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Platform Fees (15%)</p>
                  <p className="text-xl font-bold text-gray-900">${((platformStats.totalRevenue || 0) * 0.15).toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Caregiver Payouts (85%)</p>
                  <p className="text-xl font-bold text-gray-900">${((platformStats.totalRevenue || 0) * 0.85).toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Pending Payouts</p>
                  <p className="text-xl font-bold text-gray-900">$0.00</p>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">New caregiver registered: Jennifer Chen</span>
                    <span className="text-xs text-gray-400">2 hours ago</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Booking completed: Sarah Johnson</span>
                    <span className="text-xs text-gray-400">4 hours ago</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Support ticket created: Payment issue</span>
                    <span className="text-xs text-gray-400">6 hours ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
                <div className="flex space-x-3">
                  <div className="relative">
                    <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Join Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {user.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.type === 'caregiver' 
                            ? 'text-green-700 bg-green-100' 
                            : 'text-blue-700 bg-blue-100'
                        }`}>
                          {user.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(user.status)}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.joinDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button className="text-indigo-600 hover:text-indigo-900">
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          <button className="text-gray-600 hover:text-gray-900">
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          {user.status === 'active' ? (
                            <button 
                              onClick={() => updateUserStatus(user.id, 'suspended')}
                              className="text-red-600 hover:text-red-900"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          ) : (
                            <button 
                              onClick={() => updateUserStatus(user.id, 'active')}
                              className="text-green-600 hover:text-green-900"
                            >
                              <CheckCircleIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">
            {/* User Account Approvals */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Pending User Accounts</h3>
                <p className="text-gray-600 text-sm mt-1">Review and approve new user registrations</p>
              </div>

              <div className="p-6">
                {loadingUsers ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading pending users...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingUsers.map((user) => (
                      <div key={user.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                user.userType === 'CAREGIVER' ? 'text-green-700 bg-green-100' :
                                user.userType === 'PARENT' ? 'text-blue-700 bg-blue-100' :
                                'text-purple-700 bg-purple-100'
                              }`}>
                                {user.userType}
                              </span>
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {user.profile ? `${user.profile.firstName} ${user.profile.lastName}` : 'No Profile'}
                                </h4>
                                <p className="text-sm text-gray-500">{user.email}</p>
                              </div>
                              <span className="text-sm text-gray-500">
                                {new Date(user.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            
                            {user.userType === 'CAREGIVER' && user.caregiver && (
                              <div className="mt-2 text-sm text-gray-600">
                                <p>Rate: ${user.caregiver.hourlyRate}/hr • Experience: {user.caregiver.experienceYears} years</p>
                                {user.caregiver.bio && <p className="mt-1 truncate">{user.caregiver.bio}</p>}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleUserApproval(user.id, 'APPROVED')}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUserApproval(user.id, 'REJECTED')}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleUserApproval(user.id, 'SUSPENDED')}
                              className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition"
                            >
                              Suspend
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {pendingUsers.length === 0 && !loadingUsers && (
                      <div className="text-center py-8 text-gray-500">
                        <UsersIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No pending user accounts</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Content Approvals (existing) */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Content Approvals</h3>
                <p className="text-gray-600 text-sm mt-1">Review and approve caregiver submissions</p>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  {pendingApprovals.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              item.type === 'verification' ? 'text-blue-700 bg-blue-100' :
                              item.type === 'photo' ? 'text-green-700 bg-green-100' :
                              'text-purple-700 bg-purple-100'
                            }`}>
                              {item.type}
                            </span>
                            <h4 className="font-medium text-gray-900">{item.caregiverName}</h4>
                            <span className="text-sm text-gray-500">
                              {new Date(item.submittedDate).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        </div>
                        
                        <div className="flex space-x-2">
                          <button
                            onClick={() => approveItem(item.id)}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => rejectItem(item.id)}
                            className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {pendingApprovals.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <ShieldCheckIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No pending content approvals</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Support Tickets</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {supportTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{ticket.subject}</div>
                        <div className="text-sm text-gray-500">#{ticket.id}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{ticket.user}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(ticket.createdDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <button className="text-indigo-600 hover:text-indigo-900">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Platform Settings</h3>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Platform Commission Rate (%)
                  </label>
                  <input
                    type="number"
                    defaultValue="15"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Hourly Rate ($)
                  </label>
                  <input
                    type="number"
                    defaultValue="15"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Auto-approve Caregivers
                  </label>
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-600">
                    Automatically approve new caregiver registrations
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payments Tab */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* Payment Analytics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${(bookings.reduce((sum, b) => sum + b.amount, 0) / 100).toFixed(2)}
                    </p>
                  </div>
                  <BanknotesIcon className="h-8 w-8 text-green-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Platform Fees</p>
                    <p className="text-2xl font-bold text-blue-600">
                      ${(bookings.reduce((sum, b) => sum + b.platformFee, 0) / 100).toFixed(2)}
                    </p>
                  </div>
                  <CreditCardIcon className="h-8 w-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Caregiver Payouts</p>
                    <p className="text-2xl font-bold text-purple-600">
                      ${(bookings.reduce((sum, b) => sum + b.caregiverPayout, 0) / 100).toFixed(2)}
                    </p>
                  </div>
                  <UsersIcon className="h-8 w-8 text-purple-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                    <p className="text-2xl font-bold text-indigo-600">{bookings.length}</p>
                  </div>
                  <CalendarDaysIcon className="h-8 w-8 text-indigo-600" />
                </div>
              </div>
            </div>

            {/* Bookings & Payments Table */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Bookings & Payments</h3>
                  <div className="flex space-x-3">
                    <div className="relative">
                      <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search bookings..."
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Booking ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Participants
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Service Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Breakdown
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {bookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{booking.id}</div>
                          <div className="text-sm text-gray-500">{booking.createdDate}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">Parent: {booking.parentName}</div>
                            <div className="text-gray-500">Caregiver: {booking.caregiverName}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{booking.date}</div>
                            <div className="text-gray-500">
                              {booking.startTime} - {booking.endTime} ({booking.duration}h)
                            </div>
                            <div className="text-gray-500">{booking.childrenCount} children</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              Total: ${(booking.amount / 100).toFixed(2)}
                            </div>
                            <div className="text-green-600">
                              Platform: ${(booking.platformFee / 100).toFixed(2)} (15%)
                            </div>
                            <div className="text-blue-600">
                              Payout: ${(booking.caregiverPayout / 100).toFixed(2)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBookingStatusColor(booking.status)}`}>
                              {booking.status}
                            </span>
                            <br />
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(booking.paymentStatus)}`}>
                              {booking.paymentStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-col space-y-1">
                            {!booking.invoiceGenerated && (
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => generateInvoice(booking.id, 'parent')}
                                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                                >
                                  Invoice Parent
                                </button>
                                <button
                                  onClick={() => generateInvoice(booking.id, 'caregiver')}
                                  className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                                >
                                  Invoice Caregiver
                                </button>
                              </div>
                            )}
                            {booking.invoiceGenerated && (
                              <span className="text-xs text-green-600 font-medium">✓ Invoices Generated</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invoices Management */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Invoice Management</h3>
                <p className="text-sm text-gray-600 mt-1">Generated invoices for parents and caregivers</p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Booking
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recipient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{invoice.id}</div>
                          <div className="text-sm text-gray-500">{invoice.generatedDate}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{invoice.bookingId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">{invoice.recipient}</div>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              invoice.type === 'parent' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {invoice.type}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            ${(invoice.amount / 100).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => downloadInvoice(invoice)}
                              className="text-indigo-600 hover:text-indigo-900 flex items-center"
                            >
                              <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                              Download
                            </button>
                            <button className="text-gray-600 hover:text-gray-900 flex items-center">
                              <EyeIcon className="h-4 w-4 mr-1" />
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Chat Management Tab */}
        {activeTab === 'chats' && (
          <AdminChatManagement adminUserId="cmeed4ixm0000wmcsicjae17g" />
        )}

        {/* Review Moderation Tab */}
        {activeTab === 'moderation' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Review Moderation</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Approve or reject user reviews before they go public
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <select 
                    value={reviewFilter}
                    onChange={(e) => setReviewFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Reviews</option>
                    <option value="pending">Pending Only</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
              </div>

              {/* Review List with Moderation */}
              <AdminReviewList
                filterStatus={reviewFilter as 'all' | 'pending' | 'approved'}
                onModerationAction={async (reviewId, action, notes) => {
                  try {
                    const response = await fetch(`/api/reviews/${reviewId}`, {
                      method: 'PATCH',
                      headers: { 
                        'Content-Type': 'application/json',
                      },
                      credentials: 'include', // Ensure cookies are sent
                      body: JSON.stringify({
                        isApproved: action === 'approve',
                        moderatorNotes: notes || (action === 'approve' ? 'Approved by admin' : 'Rejected by admin')
                      })
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      console.log('Review moderation successful:', data);
                      alert(`Review ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
                    } else {
                      const errorData = await response.json().catch(() => ({}));
                      console.error('Moderation failed:', {
                        status: response.status,
                        statusText: response.statusText,
                        error: errorData
                      });
                      
                      if (response.status === 401) {
                        alert('Authentication required. Please refresh the page and log in as admin again.');
                        window.location.reload();
                      } else if (response.status === 403) {
                        alert('Access forbidden. Admin permissions required.');
                      } else if (response.status === 500) {
                        alert('Server error occurred. Please try again or refresh the page.');
                        window.location.reload();
                      } else {
                        alert(`Failed to moderate review: ${errorData.error || response.statusText} (Status: ${response.status})`);
                      }
                    }
                  } catch (error) {
                    console.error('Moderation error:', error);
                    alert('An error occurred while moderating the review');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Analytics placeholder */}
        {activeTab === 'analytics' && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-blue-500 mb-4">
              <ChartBarIcon className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Analytics Dashboard
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Access comprehensive business analytics including revenue tracking, user metrics, booking trends, and performance insights.
            </p>
            <Link 
              href="/analytics"
              className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-200 shadow-sm hover:shadow-md"
            >
              <ChartBarIcon className="h-5 w-5 mr-2" />
              Open Analytics Dashboard
            </Link>
          </div>
        )}
      </div>
    </AdminAuthLayout>
  );
}