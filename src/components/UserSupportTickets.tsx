"use client";

import { useState, useEffect } from "react";
import {
  ChatBubbleLeftRightIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import SupportTicketForm from "./SupportTicketForm";
import { addCSRFHeader } from '@/lib/csrf';

interface TicketResponse {
  id: string;
  message: string;
  responderId: string;
  isInternal: boolean;
  createdAt: string;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  responses: TicketResponse[];
  user?: {
    id: string;
    name: string;
    email: string;
    profile?: {
      firstName: string;
      lastName: string;
    };
  };
}

interface Booking {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
}

export interface UserSupportTicketsProps {
  userId?: string;
  userType: "PARENT" | "CAREGIVER";
  bookings?: Booking[];
}

export default function UserSupportTickets({
  userType,
  bookings = [],
}: UserSupportTicketsProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/support/tickets", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setTickets(data.data?.tickets || []);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    setLoadingTicket(true);
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedTicket(data.data);
      }
    } catch (error) {
      console.error("Error fetching ticket details:", error);
    } finally {
      setLoadingTicket(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      const response = await fetch(
        `/api/support/tickets/${selectedTicket.id}/responses`,
        {
          method: "POST",
          headers: addCSRFHeader({
            "Content-Type": "application/json",
          }),
          credentials: "include",
          body: JSON.stringify({
            message: replyMessage.trim(),
          }),
        }
      );

      if (response.ok) {
        setReplyMessage("");
        // Refresh the ticket details to show the new response
        await fetchTicketDetails(selectedTicket.id);
        // Also refresh the list to update response count
        await fetchTickets();
      }
    } catch (error) {
      console.error("Error sending reply:", error);
    } finally {
      setSendingReply(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "OPEN":
      case "AWAITING_ADMIN":
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case "IN_PROGRESS":
        return <ExclamationTriangleIcon className="h-5 w-5 text-blue-500" />;
      case "AWAITING_USER":
        return <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />;
      case "RESOLVED":
      case "CLOSED":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "text-red-600 bg-red-100";
      case "IN_PROGRESS":
        return "text-blue-600 bg-blue-100";
      case "AWAITING_USER":
        return "text-orange-600 bg-orange-100";
      case "AWAITING_ADMIN":
        return "text-yellow-600 bg-yellow-100";
      case "RESOLVED":
        return "text-green-600 bg-green-100";
      case "CLOSED":
        return "text-gray-600 bg-gray-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      BOOKING_ISSUE: "Booking Issue",
      PAYMENT_ISSUE: "Payment Issue",
      REFUND_REQUEST: "Refund Request",
      CAREGIVER_NO_SHOW: "Caregiver No-Show",
      PARENT_NO_SHOW: "Parent No-Show",
      ACCOUNT_ISSUE: "Account Issue",
      TECHNICAL_ISSUE: "Technical Issue",
      SAFETY_CONCERN: "Safety Concern",
      COMPLAINT: "Complaint",
      GENERAL_INQUIRY: "General Inquiry",
      OTHER: "Other",
    };
    return labels[category] || category;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Support Tickets</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            View and manage your support requests
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center whitespace-nowrap"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          New Ticket
        </button>
      </div>

      {/* Tickets List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">No support tickets yet</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
            >
              Create your first ticket
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => fetchTicketDetails(ticket.id)}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {getStatusIcon(ticket.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {ticket.ticketNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                            ticket.status
                          )}`}
                        >
                          {ticket.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                        {ticket.subject}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {getCategoryLabel(ticket.category)} •{" "}
                        {new Date(ticket.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {(ticket.responses?.length || 0) > 0 && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded-full">
                        {ticket.responses.length} response
                        {ticket.responses.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {ticket.status === "AWAITING_USER" && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded-full animate-pulse">
                        Reply needed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Ticket Form Modal */}
      <SupportTicketForm
        isOpen={showCreateForm}
        onClose={() => {
          setShowCreateForm(false);
          fetchTickets(); // Refresh list after creating
        }}
        userType={userType}
        bookings={bookings}
      />

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedTicket.ticketNumber}
                  </h3>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(
                      selectedTicket.status
                    )}`}
                  >
                    {selectedTicket.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {getCategoryLabel(selectedTicket.category)} • Created{" "}
                  {formatDate(selectedTicket.createdAt)}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedTicket(null);
                  setReplyMessage("");
                }}
                className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            {loadingTicket ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <>
                {/* Conversation Thread */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Original Ticket Message */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <UserCircleIcon className="h-8 w-8 text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            You
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(selectedTicket.createdAt)}
                          </p>
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedTicket.subject}
                        </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 whitespace-pre-wrap">
                          {selectedTicket.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Responses */}
                  {(selectedTicket.responses?.length || 0) === 0 ? (
                    <div className="text-center py-8">
                      <ChatBubbleLeftRightIcon className="h-10 w-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No responses yet. Our support team will get back to you soon.
                      </p>
                    </div>
                  ) : (
                    (selectedTicket.responses || []).map((response) => {
                      const isFromUser = response.responderId === selectedTicket.user?.id;
                      return (
                        <div
                          key={response.id}
                          className={`rounded-lg p-4 ${
                            isFromUser
                              ? "bg-indigo-50 dark:bg-indigo-900/30 ml-4"
                              : "bg-green-50 dark:bg-green-900/30 mr-4"
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <UserCircleIcon
                                className={`h-8 w-8 ${
                                  isFromUser
                                    ? "text-indigo-500"
                                    : "text-green-500"
                                }`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p
                                  className={`text-sm font-medium ${
                                    isFromUser
                                      ? "text-indigo-900 dark:text-indigo-200"
                                      : "text-green-900 dark:text-green-200"
                                  }`}
                                >
                                  {isFromUser ? "You" : "Support Team"}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatDate(response.createdAt)}
                                </p>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                                {response.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply Input */}
                {selectedTicket.status !== "RESOLVED" &&
                  selectedTicket.status !== "CLOSED" && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-end space-x-2">
                        <textarea
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder="Type your reply..."
                          rows={3}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white resize-none"
                        />
                        <button
                          onClick={handleSendReply}
                          disabled={!replyMessage.trim() || sendingReply}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          {sendingReply ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <PaperAirplaneIcon className="h-5 w-5 mr-1" />
                              Send
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Press Send to reply to this ticket
                      </p>
                    </div>
                  )}

                {/* Closed/Resolved Status */}
                {(selectedTicket.status === "RESOLVED" ||
                  selectedTicket.status === "CLOSED") && (
                  <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                    <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                      This ticket has been {selectedTicket.status.toLowerCase()}.
                      If you need further assistance, please create a new ticket.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
