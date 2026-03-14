'use client';

import { useState, useEffect } from 'react';
import {
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CurrencyDollarIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { addCSRFHeader } from '@/lib/csrf';

interface Extension {
  id: string;
  bookingId: string;
  extensionMinutes: number;
  extensionAmount: number;
  platformFee: number;
  caregiverPayout: number;
  hourlyRate: number;
  originalEndTime: string;
  newEndTime: string;
  status: 'PENDING' | 'PAYMENT_PENDING' | 'PAID' | 'DECLINED' | 'CANCELLED' | 'FAILED';
  reason: string | null;
  stripePaymentIntentId: string | null;
  paidAt: string | null;
  reminderCount: number;
  lastReminderSentAt: string | null;
  createdAt: string;
  parent: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
  };
  caregiver: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
  };
  booking: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
  };
}

interface ExtensionStats {
  [key: string]: {
    count: number;
    totalAmount: number;
  };
}

export default function AdminExtensionsManagement() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [stats, setStats] = useState<ExtensionStats>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  const fetchExtensions = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter === 'all'
        ? '/api/admin/extensions'
        : `/api/admin/extensions?status=${statusFilter}`;

      const response = await fetch(url, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setExtensions(data.data?.extensions || data.extensions || []);
        setStats(data.data?.stats || data.stats || {});
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to fetch extensions');
      }
    } catch (err) {
      console.error('Error fetching extensions:', err);
      setError('Failed to load extensions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtensions();
  }, [statusFilter]);

  const handleRefund = async () => {
    if (!selectedExtension) return;

    setRefundingId(selectedExtension.id);
    try {
      const response = await fetch(`/api/admin/extensions/${selectedExtension.id}/refund`, {
        method: 'POST',
        credentials: 'include',
        headers: await addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reason: refundReason })
      });

      if (response.ok) {
        alert('Extension refunded successfully');
        setShowRefundModal(false);
        setSelectedExtension(null);
        setRefundReason('');
        fetchExtensions();
      } else {
        const errData = await response.json();
        alert(`Refund failed: ${errData.error}`);
      }
    } catch (err) {
      console.error('Refund error:', err);
      alert('Failed to process refund');
    } finally {
      setRefundingId(null);
    }
  };

  const handleApprove = async (ext: Extension) => {
    if (!confirm(`Approve this ${ext.extensionMinutes}-min extension? The parent will be charged ${formatCurrency(ext.extensionAmount)}.`)) return;

    setProcessingId(ext.id);
    try {
      const response = await fetch(`/api/admin/extensions/${ext.id}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: await addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'approve' })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert(data.message || `Extension approved. Payment status: ${data.data?.status || 'processed'}`);
        fetchExtensions();
      } else {
        alert(`Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Approve error:', err);
      alert('Failed to approve extension');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async () => {
    if (!selectedExtension) return;

    setProcessingId(selectedExtension.id);
    try {
      const response = await fetch(`/api/admin/extensions/${selectedExtension.id}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: await addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'decline', reason: declineReason })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        alert('Extension declined.');
        setShowDeclineModal(false);
        setSelectedExtension(null);
        setDeclineReason('');
        fetchExtensions();
      } else {
        alert(`Failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Decline error:', err);
      alert('Failed to decline extension');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PAYMENT_PENDING: 'bg-blue-100 text-blue-800',
      PAID: 'bg-green-100 text-green-800',
      DECLINED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
      FAILED: 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PAID': return <CheckCircleIcon className="h-4 w-4 text-green-600" />;
      case 'FAILED': return <XCircleIcon className="h-4 w-4 text-red-600" />;
      case 'PENDING': case 'PAYMENT_PENDING': return <ClockIcon className="h-4 w-4 text-yellow-600" />;
      default: return <ExclamationTriangleIcon className="h-4 w-4 text-gray-600" />;
    }
  };

  const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatDateShort = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTimeAgo = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    const now = new Date();
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'N/A';
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 0) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const filteredExtensions = extensions.filter(ext => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      ext.parent.name.toLowerCase().includes(search) ||
      ext.parent.email.toLowerCase().includes(search) ||
      ext.caregiver.name.toLowerCase().includes(search) ||
      ext.caregiver.email.toLowerCase().includes(search) ||
      ext.bookingId.toLowerCase().includes(search)
    );
  });

  // Calculate totals
  const totalPaid = stats.PAID?.totalAmount || 0;
  const totalPaidCount = stats.PAID?.count || 0;
  const totalFailed = stats.FAILED?.count || 0;
  const totalPendingApproval = stats.PENDING?.count || 0;
  const totalPaymentPending = (stats.PAYMENT_PENDING?.count || 0) + totalFailed;
  const totalPlatformFees = (stats.PAID as any)?.totalPlatformFees || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Loading extensions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Paid Extensions</p>
              <p className="text-2xl font-bold text-green-600">{totalPaidCount}</p>
              <p className="text-sm text-gray-500">{formatCurrency(totalPaid)} total</p>
            </div>
            <CheckCircleIcon className="h-10 w-10 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-600">{totalPendingApproval}</p>
              <p className="text-sm text-gray-500">awaiting admin action</p>
            </div>
            <ClockIcon className="h-10 w-10 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Unpaid</p>
              <p className="text-2xl font-bold text-red-600">{totalPaymentPending}</p>
              <p className="text-sm text-gray-500">awaiting parent payment</p>
            </div>
            <ExclamationTriangleIcon className="h-10 w-10 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Platform Revenue</p>
              <p className="text-2xl font-bold text-indigo-600">
                {formatCurrency(totalPlatformFees)}
              </p>
              <p className="text-sm text-gray-500">from paid extensions</p>
            </div>
            <CurrencyDollarIcon className="h-10 w-10 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, or booking..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-72 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="PAID">Paid</option>
              <option value="PENDING">Pending Approval</option>
              <option value="PAYMENT_PENDING">Payment Pending</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="DECLINED">Declined</option>
            </select>
          </div>

          <button
            onClick={fetchExtensions}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowPathIcon className="h-5 w-5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Extensions Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Booking
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Caregiver
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Parent
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Duration
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Requested
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredExtensions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-gray-500">
                  <ClockIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No extensions found</p>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="mt-2 text-indigo-600 hover:text-indigo-800"
                    >
                      Clear search
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredExtensions.map((ext) => (
                <tr key={ext.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(ext.status)}`}>
                      {getStatusIcon(ext.status)}
                      {ext.status === 'PAYMENT_PENDING' ? 'PAY PENDING' : ext.status}
                    </span>
                    {(ext.status === 'PAYMENT_PENDING' || ext.status === 'FAILED') && (() => {
                      const ageHours = (Date.now() - new Date(ext.createdAt).getTime()) / (1000 * 60 * 60);
                      const isOverdue = ageHours >= 72;
                      const isUrgent = ageHours >= 168;
                      return (
                        <div className="mt-1 space-y-0.5">
                          {isUrgent ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-200 text-red-800">
                              <ExclamationTriangleIcon className="h-3 w-3" /> URGENT
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-orange-200 text-orange-800">
                              <ExclamationTriangleIcon className="h-3 w-3" /> OVERDUE
                            </span>
                          ) : null}
                          {ext.reminderCount > 0 && (
                            <p className="text-[10px] text-gray-500">
                              {ext.reminderCount} reminder{ext.reminderCount !== 1 ? 's' : ''} sent
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm font-medium text-gray-900">#{ext.bookingId.slice(-8)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]" title={ext.caregiver.name}>
                      {ext.caregiver.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-[120px]" title={ext.caregiver.email}>
                      {ext.caregiver.email}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]" title={ext.parent.name}>
                      {ext.parent.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-[120px]" title={ext.parent.email}>
                      {ext.parent.email}
                    </p>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {ext.extensionMinutes} min
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(ext.extensionAmount)}</p>
                    <p className="text-xs text-gray-500">
                      Fee: {formatCurrency(ext.platformFee)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Payout: {formatCurrency(ext.caregiverPayout)}
                    </p>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <p className="text-sm text-gray-900">{getTimeAgo(ext.createdAt)}</p>
                    <p className="text-xs text-gray-500">{formatDateShort(ext.createdAt)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1">
                      {ext.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(ext)}
                            disabled={processingId === ext.id}
                            className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded hover:bg-green-200 transition disabled:opacity-50"
                          >
                            {processingId === ext.id ? 'Processing...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedExtension(ext);
                              setShowDeclineModal(true);
                            }}
                            disabled={processingId === ext.id}
                            className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {ext.status === 'PAID' && (
                        <button
                          onClick={() => {
                            setSelectedExtension(ext);
                            setShowRefundModal(true);
                          }}
                          className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded hover:bg-red-200 transition"
                        >
                          Refund
                        </button>
                      )}
                      {ext.stripePaymentIntentId && (
                        <a
                          href={`https://dashboard.stripe.com/payments/${ext.stripePaymentIntentId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 transition text-center"
                        >
                          Stripe
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Refund Modal */}
      {showRefundModal && selectedExtension && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm Refund
            </h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p className="text-gray-600">Parent:</p>
                <p className="font-medium">{selectedExtension.parent.name}</p>
                <p className="text-gray-600">Amount:</p>
                <p className="font-medium text-red-600">{formatCurrency(selectedExtension.extensionAmount)}</p>
                <p className="text-gray-600">Duration:</p>
                <p className="font-medium">{selectedExtension.extensionMinutes} minutes</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Refund Reason (optional)
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Enter reason for refund..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRefundModal(false);
                  setSelectedExtension(null);
                  setRefundReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRefund}
                disabled={refundingId === selectedExtension.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {refundingId === selectedExtension.id ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Decline Modal */}
      {showDeclineModal && selectedExtension && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Decline Extension
            </h3>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p className="text-gray-600">Caregiver:</p>
                <p className="font-medium">{selectedExtension.caregiver.name}</p>
                <p className="text-gray-600">Parent:</p>
                <p className="font-medium">{selectedExtension.parent.name}</p>
                <p className="text-gray-600">Duration:</p>
                <p className="font-medium">{selectedExtension.extensionMinutes} minutes</p>
                <p className="text-gray-600">Amount:</p>
                <p className="font-medium">{formatCurrency(selectedExtension.extensionAmount)}</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for declining (optional)
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Enter reason..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeclineModal(false);
                  setSelectedExtension(null);
                  setDeclineReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={processingId === selectedExtension.id}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {processingId === selectedExtension.id ? 'Processing...' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
