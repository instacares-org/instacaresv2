'use client';

import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  ExclamationTriangleIcon,
  XMarkIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { addCSRFHeader } from '@/lib/csrf';

interface Caregiver {
  id: string;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    profile?: {
      firstName: string;
      lastName: string;
    };
  };
}

interface Warning {
  id: string;
  caregiverId: string;
  warningType: string;
  description: string;
  strikeNumber: number;
  bookingId: string | null;
  ticketId: string | null;
  issuedBy: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

const warningTypes = [
  { value: 'NO_SHOW', label: 'No Show' },
  { value: 'LATE_ARRIVAL', label: 'Late Arrival' },
  { value: 'POOR_SERVICE', label: 'Poor Service' },
  { value: 'POLICY_VIOLATION', label: 'Policy Violation' },
  { value: 'SAFETY_CONCERN', label: 'Safety Concern' },
  { value: 'OTHER', label: 'Other' }
];

export default function AdminCaregiverWarnings() {
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState<Caregiver | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showIssueWarningModal, setShowIssueWarningModal] = useState(false);
  const [showWarningsModal, setShowWarningsModal] = useState(false);
  const [issuingWarning, setIssuingWarning] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state for new warning
  const [warningForm, setWarningForm] = useState({
    warningType: 'NO_SHOW',
    description: '',
    bookingId: '',
    ticketId: ''
  });

  // Fetch caregivers
  useEffect(() => {
    fetchCaregivers();
  }, []);

  const fetchCaregivers = async () => {
    try {
      const response = await fetch('/api/admin/caregivers');
      if (response.ok) {
        const data = await response.json();
        setCaregivers(data.data?.caregivers || data.caregivers || []);
      }
    } catch (error) {
      console.error('Error fetching caregivers:', error);
    }
  };

  const fetchWarnings = async (caregiverId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/caregivers/${caregiverId}/warnings`);
      if (response.ok) {
        const data = await response.json();
        setWarnings(data.data?.warnings || []);
      } else {
        setWarnings([]);
      }
    } catch (error) {
      console.error('Error fetching warnings:', error);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewWarnings = async (caregiver: Caregiver) => {
    setSelectedCaregiver(caregiver);
    await fetchWarnings(caregiver.id);
    setShowWarningsModal(true);
  };

  const handleIssueWarning = (caregiver: Caregiver) => {
    setSelectedCaregiver(caregiver);
    setWarningForm({
      warningType: 'NO_SHOW',
      description: '',
      bookingId: '',
      ticketId: ''
    });
    setShowIssueWarningModal(true);
  };

  const submitWarning = async () => {
    if (!selectedCaregiver || !warningForm.description) {
      setMessage({ type: 'error', text: 'Description is required' });
      return;
    }

    setIssuingWarning(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/caregivers/${selectedCaregiver.id}/warnings`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          warningType: warningForm.warningType,
          description: warningForm.description,
          bookingId: warningForm.bookingId || undefined,
          ticketId: warningForm.ticketId || undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message || 'Warning issued successfully' });
        setShowIssueWarningModal(false);
        // Refresh warnings if viewing
        if (showWarningsModal) {
          await fetchWarnings(selectedCaregiver.id);
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to issue warning' });
      }
    } catch (error) {
      console.error('Error issuing warning:', error);
      setMessage({ type: 'error', text: 'Failed to issue warning' });
    } finally {
      setIssuingWarning(false);
    }
  };

  const deactivateWarning = async (warningId: string) => {
    if (!selectedCaregiver) return;

    try {
      const response = await fetch(
        `/api/admin/caregivers/${selectedCaregiver.id}/warnings?warningId=${warningId}`,
        { method: 'DELETE', headers: addCSRFHeader() }
      );

      if (response.ok) {
        await fetchWarnings(selectedCaregiver.id);
        setMessage({ type: 'success', text: 'Warning deactivated' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to deactivate warning' });
      }
    } catch (error) {
      console.error('Error deactivating warning:', error);
      setMessage({ type: 'error', text: 'Failed to deactivate warning' });
    }
  };

  const filteredCaregivers = caregivers.filter(caregiver => {
    const name = caregiver.user.profile
      ? `${caregiver.user.profile.firstName} ${caregiver.user.profile.lastName}`
      : caregiver.user.name || '';
    const email = caregiver.user.email;
    const search = searchTerm.toLowerCase();
    return name.toLowerCase().includes(search) || email.toLowerCase().includes(search);
  });

  const getCaregiverName = (caregiver: Caregiver) => {
    return caregiver.user.profile
      ? `${caregiver.user.profile.firstName} ${caregiver.user.profile.lastName}`
      : caregiver.user.name || caregiver.user.email;
  };

  return (
    <div className="p-6">
      {/* Message Banner */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          <div className="flex items-center">
            {message.type === 'success' ? (
              <CheckCircleIcon className="h-5 w-5 mr-2" />
            ) : (
              <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
            )}
            {message.text}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Caregiver Warnings</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Manage caregiver warnings and the 3-strike system
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search caregivers by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Caregivers List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Caregiver
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCaregivers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No caregivers found
                </td>
              </tr>
            ) : (
              filteredCaregivers.map((caregiver) => (
                <tr key={caregiver.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {getCaregiverName(caregiver)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {caregiver.user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex justify-center space-x-2">
                      <button
                        onClick={() => handleViewWarnings(caregiver)}
                        className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                      >
                        View Warnings
                      </button>
                      <button
                        onClick={() => handleIssueWarning(caregiver)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition flex items-center"
                      >
                        <PlusIcon className="h-4 w-4 mr-1" />
                        Issue Warning
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View Warnings Modal */}
      <Transition appear show={showWarningsModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowWarningsModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                      Warnings for {selectedCaregiver && getCaregiverName(selectedCaregiver)}
                    </Dialog.Title>
                    <button
                      onClick={() => setShowWarningsModal(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                  ) : warnings.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No warnings issued to this caregiver
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {warnings.map((warning) => (
                        <div
                          key={warning.id}
                          className={`p-4 rounded-lg border ${
                            warning.isActive
                              ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                              : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  warning.isActive
                                    ? 'bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200'
                                    : 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                                }`}>
                                  Strike {warning.strikeNumber}
                                </span>
                                <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                                  {warning.warningType.replace('_', ' ')}
                                </span>
                                {!warning.isActive && (
                                  <span className="px-2 py-1 text-xs bg-gray-200 text-gray-500 rounded">
                                    Deactivated
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                                {warning.description}
                              </p>
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Issued: {new Date(warning.createdAt).toLocaleString()}
                              </p>
                            </div>
                            {warning.isActive && (
                              <button
                                onClick={() => deactivateWarning(warning.id)}
                                className="text-sm text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setShowWarningsModal(false)}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      Close
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Issue Warning Modal */}
      <Transition appear show={showIssueWarningModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowIssueWarningModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                      <ExclamationTriangleIcon className="h-5 w-5 mr-2 text-red-500" />
                      Issue Warning
                    </Dialog.Title>
                    <button
                      onClick={() => setShowIssueWarningModal(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Issuing warning to: <span className="font-medium text-gray-900 dark:text-white">
                        {selectedCaregiver && getCaregiverName(selectedCaregiver)}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Warning Type
                      </label>
                      <select
                        value={warningForm.warningType}
                        onChange={(e) => setWarningForm({ ...warningForm, warningType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                      >
                        {warningTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description *
                      </label>
                      <textarea
                        value={warningForm.description}
                        onChange={(e) => setWarningForm({ ...warningForm, description: e.target.value })}
                        placeholder="Describe the reason for this warning..."
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Related Booking ID (optional)
                      </label>
                      <input
                        type="text"
                        value={warningForm.bookingId}
                        onChange={(e) => setWarningForm({ ...warningForm, bookingId: e.target.value })}
                        placeholder="Enter booking ID if applicable"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Related Ticket ID (optional)
                      </label>
                      <input
                        type="text"
                        value={warningForm.ticketId}
                        onChange={(e) => setWarningForm({ ...warningForm, ticketId: e.target.value })}
                        placeholder="Enter ticket ID if applicable"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      onClick={() => setShowIssueWarningModal(false)}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={submitWarning}
                      disabled={issuingWarning || !warningForm.description}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {issuingWarning ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Issuing...
                        </>
                      ) : (
                        <>
                          <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                          Issue Warning
                        </>
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
