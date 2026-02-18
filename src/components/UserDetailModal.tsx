"use client";

import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  UserCircleIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  ShieldCheckIcon,
  StarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  KeyIcon,
  PencilIcon
} from '@heroicons/react/24/outline';

interface UserDetailModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onPasswordReset: (userId: string) => void;
}

export default function UserDetailModal({ user, isOpen, onClose, onPasswordReset }: UserDetailModalProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handlePasswordReset = async () => {
    setIsResetting(true);
    await onPasswordReset(user.id);
    setIsResetting(false);
    setShowResetConfirm(false);
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title as="h3" className="text-2xl font-bold text-gray-900">
                    User Profile Details
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <UserCircleIcon className="h-5 w-5 mr-2 text-indigo-600" />
                      Basic Information
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Full Name</label>
                        <p className="text-gray-900 font-medium">{user.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Email</label>
                        <p className="text-gray-900 flex items-center">
                          <EnvelopeIcon className="h-4 w-4 mr-1 text-gray-400" />
                          {user.email}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">User Type</label>
                        <p className="text-gray-900">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.type === 'caregiver'
                              ? 'bg-purple-100 text-purple-800'
                              : user.type === 'parent'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.type}
                          </span>
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <p className="text-gray-900">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : user.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.status}
                          </span>
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Join Date</label>
                        <p className="text-gray-900 flex items-center">
                          <CalendarIcon className="h-4 w-4 mr-1 text-gray-400" />
                          {new Date(user.joinDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Verified</label>
                        <p className="text-gray-900 flex items-center">
                          {user.verified ? (
                            <>
                              <ShieldCheckIcon className="h-4 w-4 mr-1 text-green-500" />
                              <span className="text-green-600">Verified</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheckIcon className="h-4 w-4 mr-1 text-gray-400" />
                              <span className="text-gray-500">Not Verified</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Admin Actions */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h4>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        className="flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                      >
                        <KeyIcon className="h-4 w-4 mr-2" />
                        Reset Password
                      </button>
                      <button
                        className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                      >
                        <PencilIcon className="h-4 w-4 mr-2" />
                        Edit Profile
                      </button>
                      <button
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                      >
                        <EnvelopeIcon className="h-4 w-4 mr-2" />
                        Send Notification
                      </button>
                    </div>
                  </div>

                  {/* Password Reset Confirmation */}
                  {showResetConfirm && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-gray-900 mb-4">
                        Are you sure you want to reset the password for <strong>{user.name}</strong>?
                        A temporary password will be generated and sent to their email.
                      </p>
                      <div className="flex space-x-3">
                        <button
                          onClick={handlePasswordReset}
                          disabled={isResetting}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition disabled:opacity-50"
                        >
                          {isResetting ? 'Resetting...' : 'Confirm Reset'}
                        </button>
                        <button
                          onClick={() => setShowResetConfirm(false)}
                          className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Close Button */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
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
  );
}
