"use client";

import { useState, useEffect, Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { addCSRFHeader } from '@/lib/csrf';
import {
  XMarkIcon,
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface SupportTicketFormProps {
  isOpen: boolean;
  onClose: () => void;
  userType: "PARENT" | "CAREGIVER";
  bookings?: Booking[];
  preSelectedBookingId?: string;
  preSelectedCategory?: string;
}

const TICKET_CATEGORIES = {
  PARENT: [
    { value: "BOOKING_ISSUE", label: "Booking Issue" },
    { value: "PAYMENT_ISSUE", label: "Payment Issue" },
    { value: "REFUND_REQUEST", label: "Refund Request" },
    { value: "CAREGIVER_NO_SHOW", label: "Caregiver No-Show" },
    { value: "SAFETY_CONCERN", label: "Safety Concern" },
    { value: "COMPLAINT", label: "Complaint" },
    { value: "ACCOUNT_ISSUE", label: "Account Issue" },
    { value: "TECHNICAL_ISSUE", label: "Technical Issue" },
    { value: "GENERAL_INQUIRY", label: "General Inquiry" },
    { value: "OTHER", label: "Other" },
  ],
  CAREGIVER: [
    { value: "BOOKING_ISSUE", label: "Booking Issue" },
    { value: "PAYMENT_ISSUE", label: "Payment Issue" },
    { value: "PARENT_NO_SHOW", label: "Parent No-Show" },
    { value: "SAFETY_CONCERN", label: "Safety Concern" },
    { value: "COMPLAINT", label: "Complaint" },
    { value: "ACCOUNT_ISSUE", label: "Account Issue" },
    { value: "TECHNICAL_ISSUE", label: "Technical Issue" },
    { value: "GENERAL_INQUIRY", label: "General Inquiry" },
    { value: "OTHER", label: "Other" },
  ],
};

export default function SupportTicketForm({
  isOpen,
  onClose,
  userType,
  bookings = [],
  preSelectedBookingId,
  preSelectedCategory,
}: SupportTicketFormProps) {
  const [category, setCategory] = useState(preSelectedCategory || "");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [bookingId, setBookingId] = useState(preSelectedBookingId || "");
  const [priority, setPriority] = useState("NORMAL");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCategory(preSelectedCategory || "");
      setSubject("");
      setDescription("");
      setBookingId(preSelectedBookingId || "");
      setPriority("NORMAL");
      setSuccess(false);
      setError("");
      setTicketNumber("");
    }
  }, [isOpen, preSelectedCategory, preSelectedBookingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: addCSRFHeader({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          category,
          subject,
          description,
          bookingId: bookingId || null,
          priority,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTicketNumber(data.data.ticketNumber);
        setSuccess(true);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to submit ticket");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = TICKET_CATEGORIES[userType];

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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl transition-all">
                {success ? (
                  // Success State
                  <div className="text-center py-6">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                      <CheckCircleIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold text-gray-900 dark:text-white mb-2"
                    >
                      Ticket Submitted
                    </Dialog.Title>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Your support ticket has been created successfully.
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-6">
                      Ticket Number:{" "}
                      <span className="text-indigo-600 dark:text-indigo-400">{ticketNumber}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                      We'll review your ticket and respond as soon as possible.
                      You'll receive updates via email.
                    </p>
                    <button
                      onClick={onClose}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  // Form State
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-semibold text-gray-900 dark:text-white flex items-center"
                      >
                        <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                        Create Support Ticket
                      </Dialog.Title>
                      <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>

                    {error && (
                      <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center">
                        <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* Category */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Category *
                        </label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          required
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">Select a category</option>
                          {categories.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Related Booking (optional) */}
                      {bookings.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Related Booking (optional)
                          </label>
                          <select
                            value={bookingId}
                            onChange={(e) => setBookingId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="">None</option>
                            {bookings.map((booking) => (
                              <option key={booking.id} value={booking.id}>
                                {new Date(booking.startTime).toLocaleDateString()}{" "}
                                - {booking.status}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Subject */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Subject *
                        </label>
                        <input
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          required
                          placeholder="Brief summary of your issue"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description *
                        </label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          required
                          rows={5}
                          placeholder="Please describe your issue in detail..."
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                        />
                      </div>

                      {/* Priority (hidden for users, defaults to NORMAL) */}
                      <input type="hidden" value={priority} />

                      {/* Submit Button */}
                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {submitting ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                              Submitting...
                            </>
                          ) : (
                            <>
                              <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                              Submit Ticket
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
