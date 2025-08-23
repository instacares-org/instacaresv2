"use client";

import { useState, useEffect } from 'react';
import { 
  BanknotesIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon 
} from '@heroicons/react/24/outline';

interface PendingPayout {
  caregiverId: string;
  caregiverName: string;
  caregiverEmail: string;
  stripeAccountId: string;
  isDemo: boolean;
  totalOwed: number;
  bookingCount: number;
  bookings: any[];
}

interface PayoutSummary {
  totalCaregivers: number;
  totalBookings: number;
  totalOwed: number;
  demoAccounts: number;
}

export default function PayoutsManagement() {
  const [payouts, setPayouts] = useState<PendingPayout[]>([]);
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayout, setProcessingPayout] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingPayouts();
  }, []);

  const fetchPendingPayouts = async () => {
    try {
      const response = await fetch('/api/admin/payouts/pending');
      const data = await response.json();
      
      if (data.success) {
        setPayouts(data.caregivers);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const markPayoutSent = async (caregiver: PendingPayout, method: string, notes: string) => {
    setProcessingPayout(caregiver.caregiverId);
    
    try {
      const response = await fetch('/api/admin/payouts/pending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          caregiverId: caregiver.caregiverId,
          bookingIds: caregiver.bookings.map(b => b.bookingId),
          method,
          notes,
          amount: caregiver.totalOwed
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Payout recorded: $${caregiver.totalOwed.toFixed(2)} sent to ${caregiver.caregiverName}`);
        fetchPendingPayouts(); // Refresh data
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error recording payout:', error);
      alert('❌ Network error occurred');
    } finally {
      setProcessingPayout(null);
    }
  };

  const handleMarkAsPaid = (caregiver: PendingPayout) => {
    const method = prompt('Payment method (e.g., "Bank Transfer", "PayPal", "E-transfer"):', 'E-transfer');
    if (!method) return;
    
    const notes = prompt(`Notes for $${caregiver.totalOwed.toFixed(2)} payment to ${caregiver.caregiverName}:`, 
                        `Manual payout for ${caregiver.bookingCount} completed bookings`);
    if (notes === null) return;
    
    const confirmed = confirm(
      `Confirm Manual Payout\n\n` +
      `Caregiver: ${caregiver.caregiverName}\n` +
      `Email: ${caregiver.caregiverEmail}\n` +
      `Amount: $${caregiver.totalOwed.toFixed(2)}\n` +
      `Method: ${method}\n` +
      `Bookings: ${caregiver.bookingCount}\n\n` +
      `This will mark the payout as sent. Continue?`
    );
    
    if (confirmed) {
      markPayoutSent(caregiver, method, notes);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading payout data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manual Payouts Management</h1>
          <p className="text-gray-600 mt-2">
            Track and manage manual payouts for demo account caregivers
          </p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <BanknotesIcon className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Owed</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${summary.totalOwed.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Demo Accounts</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {summary.demoAccounts}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <ClockIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Bookings</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {summary.totalBookings}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <CheckCircleIcon className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Caregivers</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {summary.totalCaregivers}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pending Payouts Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Pending Payouts</h2>
          </div>

          {payouts.length === 0 ? (
            <div className="p-8 text-center">
              <BanknotesIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No pending payouts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Caregiver
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bookings
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount Owed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payouts.map((caregiver) => (
                    <tr key={caregiver.caregiverId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {caregiver.caregiverName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {caregiver.caregiverEmail}
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        {caregiver.isDemo ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <ExclamationTriangleIcon className="h-3 w-3 mr-1" />
                            Demo
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                            Real
                          </span>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {caregiver.bookingCount} completed
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ${caregiver.totalOwed.toFixed(2)}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleMarkAsPaid(caregiver)}
                          disabled={processingPayout === caregiver.caregiverId}
                          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm transition"
                        >
                          {processingPayout === caregiver.caregiverId ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent inline-block mr-1"></div>
                              Processing...
                            </>
                          ) : (
                            'Mark as Paid'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            Manual Payout Instructions
          </h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p><strong>For Demo Account Caregivers:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Send payment via e-transfer, bank transfer, or other method</li>
              <li>Click "Mark as Paid" and enter payment method and notes</li>
              <li>System will track the manual payout for record keeping</li>
            </ol>
            <p className="mt-4">
              <strong>💡 Tip:</strong> To prevent this in the future, enable real Stripe Connect 
              by setting <code className="bg-blue-100 px-1 rounded">STRIPE_CONNECT_ENABLED=true</code> 
              and helping caregivers complete real onboarding.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}