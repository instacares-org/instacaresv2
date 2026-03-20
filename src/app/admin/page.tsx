"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  ClockIcon,
  BellIcon,
  ClipboardDocumentListIcon,
  XCircleIcon,
  UserGroupIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import Image from "next/image";
import { generateStyledInvoice } from "@/components/InvoicePrintView";
import AdminChatManagement from "@/components/AdminChatManagement";
import AdminReviewList from "@/components/AdminReviewList";
import AdvancedNotificationManager from "@/components/AdvancedNotificationManager";
import AdminSupportTickets from "@/components/AdminSupportTickets";
import AdminCaregiverWarnings from "@/components/AdminCaregiverWarnings";
import AdminExtensionsManagement from "@/components/AdminExtensionsManagement";
import AdminAuditLog from "@/components/AdminAuditLog";
import UserDetailModal from "@/components/UserDetailModal";
import CaregiverDetailModal from "@/components/admin/CaregiverDetailModal";
import { addCSRFHeader } from '@/lib/csrf';

interface User {
  id: string;
  name: string;
  email: string;
  type: 'caregiver' | 'parent';
  status: 'active' | 'pending' | 'suspended';
  joinDate: string;
  verified: boolean;
  lastLoginAt?: string;
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
  userType: 'PARENT' | 'CAREGIVER' | 'BABYSITTER' | 'ADMIN';
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  createdAt: string;
  profile?: {
    firstName: string;
    lastName: string;
    phone?: string;
  };
  caregiver?: {
    id: string;
    hourlyRate: number;
    experienceYears: number;
    bio?: string;
  };
}

interface PendingBabysitter {
  id: string;
  userId: string;
  email: string;
  status: string;
  profile: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    city?: string;
    state?: string;
  };
  bio: string;
  experienceYears: number;
  hourlyRate: number;
  documents: {
    governmentIdFront: boolean;
    governmentIdBack: boolean;
    policeCheck: boolean;
    selfieForMatch: boolean;
    cprCertificate: boolean;
    eceCertificate: boolean;
  };
  verification: { phone: boolean; email: boolean };
  references: Array<{ id: string; name: string; relationship: string; isVerified: boolean }>;
  stripeOnboarded: boolean;
  acceptsOnsitePayment: boolean;
  availability: Array<{
    id: string;
    recurrenceType: string;
    dayOfWeek: number | null;
    startTime: string;
    endTime: string;
    specificDate: string | null;
    dayOfMonth: number | null;
    repeatInterval: number | null;
    isRecurring: boolean;
  }>;
  createdAt: string;
  approvedAt: string | null;
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
  const [filterType, setFilterType] = useState('all'); // New filter for user type
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [selectedCaregiverData, setSelectedCaregiverData] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [currentUserType, setCurrentUserType] = useState<string>('ADMIN');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // Real data from API
  const [users, setUsers] = useState<User[]>([]);

  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  const [bookings, setBookings] = useState<Booking[]>([]);

  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Supervisor management
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [showSupervisorForm, setShowSupervisorForm] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState<any>(null);
  const [supervisorForm, setSupervisorForm] = useState({
    email: '', password: '', firstName: '', lastName: '',
    permissions: {
      canApproveUsers: false, canManageUsers: false, canModerateReviews: false,
      canModerateChat: false, canViewFinancials: false, canProcessPayouts: false,
      canManageExtensions: false, canViewAnalytics: false, canViewAuditLogs: false,
      canManageSupport: false, canManageWarnings: false, canManageNotifications: false,
    }
  });

  // Babysitter approvals
  const [pendingBabysitters, setPendingBabysitters] = useState<PendingBabysitter[]>([]);
  const [loadingBabysitters, setLoadingBabysitters] = useState(false);
  const [babysitterStatusFilter, setBabysitterStatusFilter] = useState('pending');
  const [babysitterCounts, setBabysitterCounts] = useState({ total: 0, pending: 0, documentsSubmitted: 0, approved: 0, suspended: 0, rejected: 0 });

  // Filtered users based on search and filters
  const filteredUsers = useMemo(() => users.filter((user) => {
    // Filter by search term (name or email)
    const matchesSearch = searchTerm === '' ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    // Filter by status
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;

    // Filter by user type
    const matchesType = filterType === 'all' || user.type === filterType;

    return matchesSearch && matchesStatus && matchesType;
  }), [users, searchTerm, filterStatus, filterType]);

  // Helper function for time ago display
  const getTimeAgo = useCallback((date: string | Date): string => {
    const now = new Date();
    const past = new Date(date);
    const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (seconds < 60) {
      return `${seconds} seconds ago`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} minutes ago`;
    } else if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)} hours ago`;
    } else if (seconds < 2592000) {
      return `${Math.floor(seconds / 86400)} days ago`;
    } else if (seconds < 31536000) {
      return `${Math.floor(seconds / 2592000)} months ago`;
    } else {
      return `${Math.floor(seconds / 31536000)} years ago`;
    }
  }, []);

  // Handle viewing user details
  const handleViewUser = useCallback((user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  }, []);

  // Handle password reset for any user (parent, caregiver, supervisor)
  const handlePasswordReset = useCallback(async (userId: string): Promise<{ success: boolean; email?: string }> => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...addCSRFHeader({ 'Content-Type': 'application/json' }) },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        const data = await response.json();
        const resetData = data.data || data;
        return { success: true, email: resetData.email };
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Password reset failed:', errorData);
        return { success: false };
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      return { success: false };
    }
  }, []);

  // Platform settings state
  const [platformSettings, setPlatformSettings] = useState({
    platformCommissionRate: 15,
    minimumHourlyRate: 15,
    autoApproveCaregivers: false,
    autoApproveParents: false,
    showCaregiverContactInfo: false,
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [platformStats, setPlatformStats] = useState({
    totalUsers: 0,
    totalCaregivers: 0,
    totalBabysitters: 0,
    totalParents: 0,
    totalAdmins: 0,
    pendingVerifications: 0,
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

  const approveItem = useCallback((id: string) => {
    setPendingApprovals(prev => prev.filter(item => item.id !== id));
  }, []);

  const rejectItem = useCallback((id: string) => {
    setPendingApprovals(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateUserStatus = useCallback(async (userId: string, newStatus: 'active' | 'suspended') => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: await addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          status: newStatus.toUpperCase(),
          reason: `Status changed to ${newStatus} by admin`
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Update local state to reflect the change
        setUsers(prev => prev.map(user =>
          user.id === userId ? { ...user, status: newStatus } : user
        ));
        console.log(`User status updated to ${newStatus} successfully`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to update user status:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error || 'Unknown error'
        });
        alert(`Failed to update user status: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Failed to update user status. Please try again.');
    }
  }, []);

  // Fetch supervisors
  const fetchSupervisors = useCallback(async () => {
    setLoadingSupervisors(true);
    try {
      const response = await fetch('/api/admin/supervisors', {
        credentials: 'include',
        headers: { ...addCSRFHeader({ 'Content-Type': 'application/json' }) },
      });
      if (response.ok) {
        const result = await response.json();
        setSupervisors(result.data?.supervisors || []);
      }
    } catch (error) {
      console.error('Error fetching supervisors:', error);
    } finally {
      setLoadingSupervisors(false);
    }
  }, []);

  const handleCreateSupervisor = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/supervisors', {
        method: 'POST',
        credentials: 'include',
        headers: { ...addCSRFHeader({ 'Content-Type': 'application/json' }) },
        body: JSON.stringify(supervisorForm),
      });
      if (response.ok) {
        setShowSupervisorForm(false);
        setSupervisorForm({
          email: '', password: '', firstName: '', lastName: '',
          permissions: {
            canApproveUsers: false, canManageUsers: false, canModerateReviews: false,
            canModerateChat: false, canViewFinancials: false, canProcessPayouts: false,
            canManageExtensions: false, canViewAnalytics: false, canViewAuditLogs: false,
            canManageSupport: false, canManageWarnings: false, canManageNotifications: false,
          }
        });
        fetchSupervisors();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to create supervisor');
      }
    } catch (error) {
      console.error('Error creating supervisor:', error);
    }
  }, [supervisorForm, fetchSupervisors]);

  const handleUpdateSupervisor = useCallback(async (id: string, data: any) => {
    try {
      const response = await fetch(`/api/admin/supervisors/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { ...addCSRFHeader({ 'Content-Type': 'application/json' }) },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        setEditingSupervisor(null);
        fetchSupervisors();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to update supervisor');
      }
    } catch (error) {
      console.error('Error updating supervisor:', error);
    }
  }, [fetchSupervisors]);

  const handleToggleSupervisorStatus = useCallback(async (id: string, isActive: boolean) => {
    await handleUpdateSupervisor(id, { isActive: !isActive });
  }, [handleUpdateSupervisor]);

  const handleResetSupervisorPassword = useCallback(async (id: string, name: string) => {
    if (!confirm(`Reset password for supervisor "${name}"? They will receive a new temporary password via email and must change it on next login.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/users/${id}/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...addCSRFHeader({ 'Content-Type': 'application/json' }) },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (response.ok) {
        alert(data.message || 'Password reset successfully. Temporary password sent via email.');
      } else {
        alert(data.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting supervisor password:', error);
    }
  }, []);

  const handleDeleteSupervisor = useCallback(async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete supervisor "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const response = await fetch(`/api/admin/supervisors/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { ...addCSRFHeader({ 'Content-Type': 'application/json' }) },
      });
      if (response.ok) {
        fetchSupervisors();
      } else {
        const err = await response.json();
        alert(err.error || 'Failed to delete supervisor');
      }
    } catch (error) {
      console.error('Error deleting supervisor:', error);
    }
  }, [fetchSupervisors]);

  // Fetch pending users
  const fetchPendingUsers = useCallback(async () => {
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
        setPendingUsers(data.data?.users || data.users || []);
      } else {
        console.error('Failed to fetch pending users');
      }
    } catch (error) {
      console.error('Error fetching pending users:', error);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Handle user approval/rejection
  
  
  const fetchCaregiverDetails = useCallback(async (caregiverId: string) => {
    try {
      const response = await fetch(`/api/admin/caregivers/${caregiverId}/detailed-approval`, {
        method: 'GET',
        headers: await addCSRFHeader({})
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedCaregiverData(data.data || data);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch caregiver details:', error);
    }
  }, []);

  const handleUpdateVerification = useCallback(async (caregiverId: string, type: string, status: string) => {
    try {
      const response = await fetch('/api/admin/verifications', {
        method: 'PUT',
        headers: await addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ caregiverId, verificationType: type, status })
      });
      if (response.ok) {
        // Refresh the caregiver data
        await fetchCaregiverDetails(caregiverId);
      }
    } catch (error) {
      console.error('Failed to update verification:', error);
    }
  }, [fetchCaregiverDetails]);

const handleUserApproval = useCallback(async (userId: string, action: 'APPROVED' | 'REJECTED' | 'SUSPENDED', reason?: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/approval`, {
        method: 'POST',
        credentials: 'include',
        headers: await addCSRFHeader({
          "Content-Type": "application/json",
        }),
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
  }, []);

  // Fetch babysitters for admin approval
  const fetchBabysitters = useCallback(async (statusFilter?: string) => {
    setLoadingBabysitters(true);
    try {
      const response = await fetch('/api/admin/babysitters', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        const babysitters = data.data?.babysitters || data.babysitters || [];
        const counts = data.data?.counts || data.counts;
        let filtered = babysitters;
        if (!statusFilter || statusFilter === 'pending') {
          filtered = babysitters.filter((b: PendingBabysitter) =>
            b.status === 'PENDING_VERIFICATION' || b.status === 'DOCUMENTS_SUBMITTED'
          );
        } else if (statusFilter !== 'all') {
          filtered = babysitters.filter((b: PendingBabysitter) =>
            b.status === statusFilter.toUpperCase()
          );
        }
        setPendingBabysitters(filtered);
        setBabysitterCounts(counts);
      }
    } catch (error) {
      console.error('Error fetching babysitters:', error);
    } finally {
      setLoadingBabysitters(false);
    }
  }, []);

  const handleBabysitterAction = useCallback(async (babysitterId: string, action: 'approve' | 'reject' | 'suspend' | 'unsuspend') => {
    try {
      const response = await fetch(`/api/admin/babysitters/${babysitterId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: await addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action }),
      });
      if (response.ok) {
        fetchBabysitters(babysitterStatusFilter);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to ${action} babysitter: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating babysitter:', error);
    }
  }, [babysitterStatusFilter, fetchBabysitters]);

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
            totalBabysitters: 0,
            totalParents: 0,
            totalAdmins: 0,
            pendingVerifications: 0,
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
          totalBabysitters: 0,
          totalParents: 0,
          totalAdmins: 0,
          pendingVerifications: 0,
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

    // Fetch permissions from admin session
    const fetchPermissions = async () => {
      try {
        const res = await fetch('/api/admin/session', { credentials: 'include' });
        if (res.ok) {
          const result = await res.json();
          const admin = result.data?.admin || result.admin;
          if (admin?.permissions) setPermissions(admin.permissions);
          if (admin?.userType) setCurrentUserType(admin.userType);
        }
      } catch (err) {
        console.error('Error fetching permissions:', err);
      }
    };
    fetchPermissions();
  }, []);

  // Load pending users and babysitters when approvals tab is active
  useEffect(() => {
    if (activeTab === 'approvals') {
      fetchPendingUsers();
      fetchBabysitters(babysitterStatusFilter);
    }
  }, [activeTab]);

  // Fetch supervisors when tab is active
  useEffect(() => {
    if (activeTab === 'supervisors') {
      fetchSupervisors();
    }
  }, [activeTab]);

  // Fetch platform settings when settings tab is active
  useEffect(() => {
    if (activeTab === 'settings') {
      fetchPlatformSettings();
    }
  }, [activeTab]);

  const fetchPlatformSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const response = await fetch('/api/admin/settings', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPlatformSettings(data.data?.settings || data.settings);
      } else {
        console.error('Failed to fetch platform settings');
      }
    } catch (error) {
      console.error('Error fetching platform settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  const savePlatformSettings = useCallback(async () => {
    setSavingSettings(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: await addCSRFHeader({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(platformSettings),
      });
      if (response.ok) {
        const data = await response.json();
        setPlatformSettings(data.data?.settings || data.settings);
        alert('Settings saved successfully!');
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Failed to save settings: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving platform settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSavingSettings(false);
    }
  }, [platformSettings]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'suspended': return 'text-red-600 bg-red-100';
      case 'open': return 'text-red-600 bg-red-100';
      case 'in-progress': return 'text-blue-600 bg-blue-100';
      case 'closed': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }, []);

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }, []);

  const getBookingStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      case 'disputed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }, []);

  const getPaymentStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'refunded': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }, []);

  const generateInvoice = useCallback((bookingId: string, type: 'parent' | 'caregiver') => {
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
  }, [bookings]);

  const downloadInvoice = useCallback((invoice: Invoice) => {
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
  }, [bookings]);

  // Memoized booking stats
  const totalRevenue = useMemo(() => bookings.reduce((sum, b) => sum + b.amount, 0), [bookings]);
  const totalPlatformFees = useMemo(() => bookings.reduce((sum, b) => sum + b.platformFee, 0), [bookings]);
  const totalCaregiverPayouts = useMemo(() => bookings.reduce((sum, b) => sum + b.caregiverPayout, 0), [bookings]);

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
    <AdminAuthLayout title="Admin Dashboard" className="bg-gray-50 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { key: 'overview', label: 'Overview', icon: ChartBarIcon, permission: null },
            { key: 'users', label: 'Users', icon: UsersIcon, permission: 'canManageUsers' },
            { key: 'payments', label: 'Payments', icon: CreditCardIcon, permission: 'canViewFinancials' },
            { key: 'extensions', label: 'Extensions', icon: ClockIcon, permission: 'canManageExtensions' },
            { key: 'approvals', label: 'Approvals', icon: ShieldCheckIcon, permission: 'canApproveUsers' },
            { key: 'moderation', label: 'Reviews', icon: EyeIcon, permission: 'canModerateReviews' },
            { key: 'chats', label: 'Chat Management', icon: ChatBubbleLeftRightIcon, permission: 'canModerateChat' },
            { key: 'notifications', label: 'Notifications', icon: BellIcon, permission: 'canManageNotifications' },
            { key: 'analytics', label: 'Analytics', icon: DocumentChartBarIcon, permission: 'canViewAnalytics' },
            { key: 'support', label: 'Support', icon: ExclamationTriangleIcon, permission: 'canManageSupport' },
            { key: 'warnings', label: 'Warnings', icon: ExclamationTriangleIcon, permission: 'canManageWarnings' },
            { key: 'audit', label: 'Audit Log', icon: ClipboardDocumentListIcon, permission: 'canViewAuditLogs' },
            { key: 'supervisors', label: 'Supervisors', icon: UserGroupIcon, permission: 'canManageSupervisors' },
            { key: 'settings', label: 'Settings', icon: CogIcon, permission: 'canManageSettings' },
          ]
          .filter(tab => tab.permission === null || permissions[tab.permission])
          .map(tab => (
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
                title="Babysitters"
                value={platformStats.totalBabysitters || 0}
                subtitle="Babysitting providers"
                icon={UsersIcon}
                color="text-orange-600"
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
                  <p className="text-sm text-gray-600">Platform Fees (Actual)</p>
                  <p className="text-xl font-bold text-gray-900">${((platformStats.totalPlatformFees || 0) / 100).toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <p className="text-sm text-gray-600">Caregiver Payouts (Actual)</p>
                  <p className="text-xl font-bold text-gray-900">${((platformStats.totalPayouts || 0) / 100).toFixed(2)}</p>
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
                {/* Generate sample recent activities */}
                <div className="space-y-4">
                  {users.slice(0, 5).map((user, index) => {
                    const activities = [
                      {
                        type: 'user_joined',
                        message: `New ${user.type} registered: ${user.name}`,
                        icon: UsersIcon,
                        color: 'text-green-600 bg-green-100'
                      },
                      {
                        type: 'booking_created',
                        message: `New booking created by ${user.name}`,
                        icon: CalendarDaysIcon,
                        color: 'text-blue-600 bg-blue-100'
                      },
                      {
                        type: 'profile_updated',
                        message: `${user.name} updated their profile`,
                        icon: PencilIcon,
                        color: 'text-yellow-600 bg-yellow-100'
                      }
                    ];
                    const activity = activities[index % activities.length];
                    const ActivityIcon = activity.icon;

                    return (
                      <div key={`activity-${user.id}`} className="flex items-start space-x-3">
                        <div className={`p-2 rounded-lg ${activity.color}`}>
                          <ActivityIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-900">{activity.message}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {getTimeAgo(user.joinDate)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {users.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <ClockIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No recent activity to display</p>
                    </div>
                  )}
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
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    User Management
                    <span className="ml-2 text-sm text-gray-500">
                      ({filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'})
                    </span>
                  </h3>
                </div>
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
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All Types</option>
                    <option value="caregiver">Caregivers</option>
                    <option value="parent">Parents</option>
                  </select>
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
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <UsersIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-gray-500 text-sm">
                          No users found matching your filters.
                          {searchTerm && (
                            <button
                              onClick={() => setSearchTerm('')}
                              className="ml-2 text-indigo-600 hover:text-indigo-800"
                            >
                              Clear search
                            </button>
                          )}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
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
                            <button
                              onClick={() => handleViewUser(user)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="View user details"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button className="text-gray-600 hover:text-gray-900" title="Edit user">
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            {user.status === 'active' ? (
                              <button
                                onClick={() => updateUserStatus(user.id, 'suspended')}
                                className="text-red-600 hover:text-red-900"
                                title="Suspend user"
                              >
                                <XMarkIcon className="h-4 w-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => updateUserStatus(user.id, 'active')}
                                className="text-green-600 hover:text-green-900"
                                title="Activate user"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
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
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3">
                              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                user.userType === 'CAREGIVER' ? 'text-green-700 bg-green-100' :
                                user.userType === 'BABYSITTER' ? 'text-orange-700 bg-orange-100' :
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
                          
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {user.caregiver && (
                              <button
                                onClick={() => fetchCaregiverDetails(user.caregiver!.id)}
                                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition whitespace-nowrap"
                              >
                                View Details
                              </button>
                            )}
                            <button
                              onClick={() => handleUserApproval(user.id, 'APPROVED')}
                              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition whitespace-nowrap"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUserApproval(user.id, 'REJECTED')}
                              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition whitespace-nowrap"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleUserApproval(user.id, 'SUSPENDED')}
                              className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition whitespace-nowrap"
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

            {/* Babysitter Applications */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Babysitter Applications</h3>
                    <p className="text-gray-600 text-sm mt-1">Review babysitter registrations and completion steps</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    {[
                      { key: 'pending', label: 'Pending', count: babysitterCounts.pending + babysitterCounts.documentsSubmitted },
                      { key: 'approved', label: 'Approved', count: babysitterCounts.approved },
                      { key: 'suspended', label: 'Suspended', count: babysitterCounts.suspended },
                      { key: 'rejected', label: 'Rejected', count: babysitterCounts.rejected },
                      { key: 'all', label: 'All', count: babysitterCounts.total },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => { setBabysitterStatusFilter(f.key); fetchBabysitters(f.key); }}
                        className={`px-3 py-1.5 rounded-full font-medium transition ${
                          babysitterStatusFilter === f.key
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {f.label} ({f.count})
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6">
                {loadingBabysitters ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading babysitter applications...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingBabysitters.map((bs) => {
                      const requiredSteps = [
                        { label: 'Basic Info', done: true },
                        { label: 'Government ID', done: bs.documents.governmentIdFront && bs.documents.governmentIdBack },
                        { label: 'Police Check', done: bs.documents.policeCheck },
                        { label: 'Selfie Match', done: bs.documents.selfieForMatch },
                        { label: 'Phone Verified', done: bs.verification.phone },
                      ];
                      const optionalSteps = [
                        { label: 'CPR Cert', done: bs.documents.cprCertificate },
                        { label: 'ECE Cert', done: bs.documents.eceCertificate },
                        { label: 'Stripe Setup', done: bs.stripeOnboarded },
                        { label: `References (${bs.references.length})`, done: bs.references.length > 0 },
                        { label: `Schedule (${bs.availability?.length || 0})`, done: (bs.availability?.length || 0) > 0 },
                      ];
                      const allRequiredDone = requiredSteps.every(s => s.done);
                      const statusColor = bs.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        bs.status === 'SUSPENDED' ? 'bg-yellow-100 text-yellow-700' :
                        bs.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700';

                      return (
                        <div key={bs.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor}`}>
                                  {bs.status.replace(/_/g, ' ')}
                                </span>
                                <h4 className="font-medium text-gray-900">
                                  {bs.profile?.firstName} {bs.profile?.lastName}
                                </h4>
                              </div>
                              <p className="text-sm text-gray-500 mt-0.5">
                                {bs.email} &middot; ${bs.hourlyRate}/hr &middot; {bs.experienceYears}yr exp
                                {bs.profile?.city && ` &middot; ${bs.profile.city}${bs.profile.state ? `, ${bs.profile.state}` : ''}`}
                              </p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                Registered {new Date(bs.createdAt).toLocaleDateString()}
                                {bs.approvedAt && ` &middot; Approved ${new Date(bs.approvedAt).toLocaleDateString()}`}
                              </p>
                            </div>
                          </div>

                          {/* Step Completion Checklist */}
                          <div className="mb-3">
                            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Registration Steps</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                              {requiredSteps.map((step) => (
                                <div key={step.label} className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded ${
                                  step.done
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-red-50 text-red-600'
                                }`}>
                                  {step.done ? (
                                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                                  ) : (
                                    <XCircleIcon className="h-4 w-4 flex-shrink-0" />
                                  )}
                                  <span>{step.label}</span>
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
                              {optionalSteps.map((step) => (
                                <div key={step.label} className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded ${
                                  step.done
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-gray-50 text-gray-400'
                                }`}>
                                  {step.done ? (
                                    <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                                  ) : (
                                    <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-gray-300" />
                                  )}
                                  <span>{step.label}</span>
                                  {!step.done && <span className="text-gray-300 ml-auto">(optional)</span>}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Service Type & Schedule */}
                          <div className="mb-3 flex flex-wrap gap-3">
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-violet-50 text-violet-700">
                              Travels to client location
                            </span>
                            {bs.acceptsOnsitePayment && (
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-emerald-50 text-emerald-700">
                                Accepts on-site payment
                              </span>
                            )}
                          </div>

                          {/* Schedule Display */}
                          {bs.availability && bs.availability.length > 0 && (
                            <div className="mb-3 bg-gray-50 rounded-lg p-3">
                              <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Configured Schedule</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                                {bs.availability.map((slot) => {
                                  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                  let label = '';
                                  if (slot.recurrenceType === 'WEEKLY') {
                                    label = slot.dayOfWeek !== null ? dayNames[slot.dayOfWeek] : 'Weekly';
                                    if (slot.repeatInterval && slot.repeatInterval > 1) {
                                      label += ` (every ${slot.repeatInterval} weeks)`;
                                    }
                                  } else if (slot.recurrenceType === 'ONCE') {
                                    label = slot.specificDate ? new Date(slot.specificDate).toLocaleDateString() : 'One-time';
                                  } else if (slot.recurrenceType === 'MONTHLY') {
                                    label = slot.dayOfMonth ? `Monthly (day ${slot.dayOfMonth})` : 'Monthly';
                                  } else {
                                    label = slot.dayOfWeek !== null ? dayNames[slot.dayOfWeek] : 'Available';
                                  }
                                  return (
                                    <div key={slot.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border border-gray-200">
                                      <span className="font-medium text-gray-900">{label}</span>
                                      <span className="text-gray-500 ml-2">{slot.startTime} - {slot.endTime}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            {(bs.status === 'PENDING_VERIFICATION' || bs.status === 'DOCUMENTS_SUBMITTED') && (
                              <>
                                <button
                                  onClick={() => handleBabysitterAction(bs.id, 'approve')}
                                  disabled={!allRequiredDone}
                                  className={`px-3 py-1 text-sm rounded font-medium transition ${
                                    allRequiredDone
                                      ? 'bg-green-600 text-white hover:bg-green-700'
                                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                  }`}
                                  title={!allRequiredDone ? 'All required steps must be completed before approving' : 'Approve this babysitter'}
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleBabysitterAction(bs.id, 'reject')}
                                  className="px-3 py-1 bg-red-600 text-white text-sm rounded font-medium hover:bg-red-700 transition"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {bs.status === 'APPROVED' && (
                              <button
                                onClick={() => handleBabysitterAction(bs.id, 'suspend')}
                                className="px-3 py-1 bg-yellow-600 text-white text-sm rounded font-medium hover:bg-yellow-700 transition"
                              >
                                Suspend
                              </button>
                            )}
                            {bs.status === 'SUSPENDED' && (
                              <button
                                onClick={() => handleBabysitterAction(bs.id, 'unsuspend')}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700 transition"
                              >
                                Unsuspend
                              </button>
                            )}
                            {!allRequiredDone && (bs.status === 'PENDING_VERIFICATION' || bs.status === 'DOCUMENTS_SUBMITTED') && (
                              <span className="text-xs text-red-500 ml-2">
                                Missing: {requiredSteps.filter(s => !s.done).map(s => s.label).join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {pendingBabysitters.length === 0 && !loadingBabysitters && (
                      <div className="text-center py-8 text-gray-500">
                        <ShieldCheckIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No babysitter applications in this category</p>
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

        {/* Extensions Tab */}
        {activeTab === 'extensions' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                    <ClockIcon className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Booking Extensions</h3>
                  <p className="text-sm text-gray-600">
                    Monitor and manage overtime/extension charges when parents are late for pickup
                  </p>
                </div>
              </div>
              <AdminExtensionsManagement />
            </div>
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <AdminSupportTickets />
        )}

        {/* Warnings Tab */}
        {activeTab === 'warnings' && (
          <AdminCaregiverWarnings />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Platform Settings</h3>
              </div>
              <div className="p-6 space-y-6">
                {loadingSettings ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="text-gray-500 mt-2">Loading settings...</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Platform Commission Rate (%)
                      </label>
                      <input
                        type="number"
                        value={platformSettings.platformCommissionRate}
                        onChange={(e) => setPlatformSettings(prev => ({
                          ...prev,
                          platformCommissionRate: parseFloat(e.target.value) || 0
                        }))}
                        min="0"
                        max="100"
                        step="0.1"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Minimum Hourly Rate ($)
                      </label>
                      <input
                        type="number"
                        value={platformSettings.minimumHourlyRate}
                        onChange={(e) => setPlatformSettings(prev => ({
                          ...prev,
                          minimumHourlyRate: parseFloat(e.target.value) || 0
                        }))}
                        min="0"
                        step="0.01"
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Auto-approval Settings
                      </label>
                      <div className="space-y-3">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={platformSettings.autoApproveCaregivers}
                            onChange={(e) => setPlatformSettings(prev => ({
                              ...prev,
                              autoApproveCaregivers: e.target.checked
                            }))}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-600">
                            Automatically approve new caregiver registrations
                          </span>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={platformSettings.autoApproveParents}
                            onChange={(e) => setPlatformSettings(prev => ({
                              ...prev,
                              autoApproveParents: e.target.checked
                            }))}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-600">
                            Automatically approve new parent registrations
                          </span>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={platformSettings.showCaregiverContactInfo}
                            onChange={(e) => setPlatformSettings(prev => ({
                              ...prev,
                              showCaregiverContactInfo: e.target.checked
                            }))}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-600">
                            Show caregiver email and phone number to parents
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                      <button
                        onClick={savePlatformSettings}
                        disabled={savingSettings}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingSettings ? 'Saving...' : 'Save Settings'}
                      </button>
                    </div>
                  </>
                )}
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
                      ${(totalRevenue / 100).toFixed(2)}
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
                      ${(totalPlatformFees / 100).toFixed(2)}
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
                      ${(totalCaregiverPayouts / 100).toFixed(2)}
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
                              Platform: ${(booking.platformFee / 100).toFixed(2)} ({booking.amount > 0 ? Math.round((booking.platformFee / booking.amount) * 100) : 0}%)
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
          <AdminChatManagement adminUserId="cmg2l4b3c0000jx5ldgabxuea" />
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
                      headers: { ...addCSRFHeader({ 'Content-Type': 'application/json' }) },
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

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <BellIcon className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Notification Management</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Test and manage email and SMS notifications
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <AdvancedNotificationManager />
              </div>
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <AdminAuditLog />
        )}

        {/* Supervisors Tab */}
        {activeTab === 'supervisors' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">Supervisor Management</h2>
              <button
                onClick={() => { setShowSupervisorForm(true); setEditingSupervisor(null); }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center"
              >
                <UserGroupIcon className="h-5 w-5 mr-2" />
                Add Supervisor
              </button>
            </div>

            {/* Create/Edit Form Modal */}
            {(showSupervisorForm || editingSupervisor) && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {editingSupervisor ? 'Edit Supervisor Permissions' : 'Create New Supervisor'}
                </h3>

                {!editingSupervisor && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email" value={supervisorForm.email}
                        onChange={e => setSupervisorForm({ ...supervisorForm, email: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="supervisor@instacares.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input
                        type="password" value={supervisorForm.password}
                        onChange={e => setSupervisorForm({ ...supervisorForm, password: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Min 8 characters"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input
                        type="text" value={supervisorForm.firstName}
                        onChange={e => setSupervisorForm({ ...supervisorForm, firstName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input
                        type="text" value={supervisorForm.lastName}
                        onChange={e => setSupervisorForm({ ...supervisorForm, lastName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}

                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Permissions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { key: 'canApproveUsers', label: 'Approve Users', desc: 'Approve/reject caregivers & babysitters' },
                      { key: 'canManageUsers', label: 'Manage Users', desc: 'View user details, reset passwords' },
                      { key: 'canModerateReviews', label: 'Moderate Reviews', desc: 'Flag/remove reviews' },
                      { key: 'canModerateChat', label: 'Moderate Chat', desc: 'Monitor & manage chat rooms' },
                      { key: 'canViewFinancials', label: 'View Financials', desc: 'See revenue & payment data' },
                      { key: 'canProcessPayouts', label: 'Process Payouts', desc: 'Handle caregiver payouts' },
                      { key: 'canManageExtensions', label: 'Manage Extensions', desc: 'Approve booking extensions' },
                      { key: 'canViewAnalytics', label: 'View Analytics', desc: 'Access analytics dashboard' },
                      { key: 'canViewAuditLogs', label: 'View Audit Logs', desc: 'Read admin audit trail' },
                      { key: 'canManageSupport', label: 'Manage Support', desc: 'Handle support tickets' },
                      { key: 'canManageWarnings', label: 'Manage Warnings', desc: 'Issue caregiver warnings' },
                      { key: 'canManageNotifications', label: 'Manage Notifications', desc: 'Send & manage notifications' },
                    ].map(perm => {
                      const currentPerms = editingSupervisor?.permissions || supervisorForm.permissions;
                      const isChecked = currentPerms[perm.key as keyof typeof currentPerms] || false;
                      return (
                        <label key={perm.key} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox" checked={isChecked}
                            onChange={e => {
                              const updated = { ...currentPerms, [perm.key]: e.target.checked };
                              if (editingSupervisor) {
                                setEditingSupervisor({ ...editingSupervisor, permissions: updated });
                              } else {
                                setSupervisorForm({ ...supervisorForm, permissions: updated });
                              }
                            }}
                            className="mt-1 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{perm.label}</div>
                            <div className="text-xs text-gray-500">{perm.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => { setShowSupervisorForm(false); setEditingSupervisor(null); }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editingSupervisor) {
                        handleUpdateSupervisor(editingSupervisor.id, { permissions: editingSupervisor.permissions });
                      } else {
                        handleCreateSupervisor();
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    {editingSupervisor ? 'Update Permissions' : 'Create Supervisor'}
                  </button>
                </div>
              </div>
            )}

            {/* Supervisors Table */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {loadingSupervisors ? (
                <div className="p-8 text-center text-gray-500">Loading supervisors...</div>
              ) : supervisors.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <UserGroupIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No supervisors created yet.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {supervisors.map(sup => {
                      const permCount = sup.permissions ? Object.values(sup.permissions).filter(Boolean).length : 0;
                      return (
                        <tr key={sup.id} className={!sup.isActive ? 'bg-gray-50 opacity-60' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {sup.profile?.firstName} {sup.profile?.lastName}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sup.email}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              sup.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {sup.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {permCount}/12 enabled
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(sup.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                            <button
                              onClick={() => setEditingSupervisor(sup)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleResetSupervisorPassword(sup.id, `${sup.profile?.firstName || ''} ${sup.profile?.lastName || ''}`.trim())}
                              className="text-orange-600 hover:text-orange-900"
                            >
                              Reset PW
                            </button>
                            <button
                              onClick={() => handleToggleSupervisorStatus(sup.id, sup.isActive)}
                              className={sup.isActive ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}
                            >
                              {sup.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => handleDeleteSupervisor(sup.id, `${sup.profile?.firstName || ''} ${sup.profile?.lastName || ''}`.trim())}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
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

      {/* User Details Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          isOpen={showUserModal}
          onClose={() => {
            setShowUserModal(false);
            setSelectedUser(null);
          }}
          onPasswordReset={handlePasswordReset}
        />
      )}

      {/* Caregiver Detail Modal */}
      <CaregiverDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedCaregiverData(null);
        }}
        caregiverData={selectedCaregiverData}
        onApprove={(userId, notes) => handleUserApproval(userId, 'APPROVED', notes)}
        onReject={(userId, reason) => handleUserApproval(userId, 'REJECTED', reason)}
        onUpdateVerification={handleUpdateVerification}
      />
    </AdminAuthLayout>
  );
}