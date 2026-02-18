"use client";

import { useState, useEffect } from "react";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChatBubbleLeftRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { addCSRFHeader } from '@/lib/csrf';

interface Ticket {
  id: string;
  ticketNumber: string;
  userId: string;
  userType: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  bookingId?: string;
  assignedTo?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    userType: string;
    profile?: {
      firstName: string;
      lastName: string;
      avatar?: string;
    };
  };
  booking?: {
    id: string;
    startTime: string;
    endTime: string;
    status: string;
  };
  responses: {
    id: string;
    responderId: string;
    message: string;
    isInternal: boolean;
    createdAt: string;
  }[];
}

export default function AdminSupportTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [newResponse, setNewResponse] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingResponse, setSendingResponse] = useState(false);

  // Fetch tickets
  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterCategory !== "all") params.append("category", filterCategory);

      const response = await fetch(`/api/support/tickets?${params.toString()}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setTickets(data.data.tickets);
      } else {
        console.error("Failed to fetch tickets");
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [filterStatus, filterCategory]);

  // Fetch single ticket with all responses
  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedTicket(data.data);
        setShowTicketModal(true);
      }
    } catch (error) {
      console.error("Error fetching ticket details:", error);
    }
  };

  // Update ticket status
  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        credentials: "include",
        headers: addCSRFHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        fetchTickets();
        if (selectedTicket?.id === ticketId) {
          fetchTicketDetails(ticketId);
        }
      }
    } catch (error) {
      console.error("Error updating ticket:", error);
    }
  };

  // Update ticket priority
  const updateTicketPriority = async (ticketId: string, priority: string) => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        credentials: "include",
        headers: addCSRFHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ priority }),
      });

      if (response.ok) {
        fetchTickets();
        if (selectedTicket?.id === ticketId) {
          fetchTicketDetails(ticketId);
        }
      }
    } catch (error) {
      console.error("Error updating ticket:", error);
    }
  };

  // Resolve ticket
  const resolveTicket = async (ticketId: string, resolution: string) => {
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "PATCH",
        credentials: "include",
        headers: addCSRFHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ resolution }),
      });

      if (response.ok) {
        fetchTickets();
        setShowTicketModal(false);
        setSelectedTicket(null);
      }
    } catch (error) {
      console.error("Error resolving ticket:", error);
    }
  };

  // Send response
  const sendResponse = async () => {
    if (!selectedTicket || !newResponse.trim()) return;

    setSendingResponse(true);
    try {
      const response = await fetch(
        `/api/support/tickets/${selectedTicket.id}/responses`,
        {
          method: "POST",
          credentials: "include",
          headers: addCSRFHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            message: newResponse,
            isInternal: isInternalNote,
          }),
        }
      );

      if (response.ok) {
        setNewResponse("");
        setIsInternalNote(false);
        fetchTicketDetails(selectedTicket.id);
      }
    } catch (error) {
      console.error("Error sending response:", error);
    } finally {
      setSendingResponse(false);
    }
  };

  // Filter tickets by search term
  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      searchTerm === "" ||
      ticket.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority =
      filterPriority === "all" || ticket.priority === filterPriority;

    return matchesSearch && matchesPriority;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "text-red-600 bg-red-100";
      case "IN_PROGRESS":
        return "text-blue-600 bg-blue-100";
      case "AWAITING_USER":
        return "text-yellow-600 bg-yellow-100";
      case "AWAITING_ADMIN":
        return "text-orange-600 bg-orange-100";
      case "RESOLVED":
        return "text-green-600 bg-green-100";
      case "CLOSED":
        return "text-gray-600 bg-gray-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "text-red-600 bg-red-100";
      case "HIGH":
        return "text-orange-600 bg-orange-100";
      case "NORMAL":
        return "text-blue-600 bg-blue-100";
      case "LOW":
        return "text-green-600 bg-green-100";
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="AWAITING_USER">Awaiting User</option>
            <option value="AWAITING_ADMIN">Awaiting Admin</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Categories</option>
            <option value="BOOKING_ISSUE">Booking Issue</option>
            <option value="PAYMENT_ISSUE">Payment Issue</option>
            <option value="REFUND_REQUEST">Refund Request</option>
            <option value="CAREGIVER_NO_SHOW">Caregiver No-Show</option>
            <option value="PARENT_NO_SHOW">Parent No-Show</option>
            <option value="ACCOUNT_ISSUE">Account Issue</option>
            <option value="TECHNICAL_ISSUE">Technical Issue</option>
            <option value="SAFETY_CONCERN">Safety Concern</option>
            <option value="COMPLAINT">Complaint</option>
            <option value="GENERAL_INQUIRY">General Inquiry</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Priority</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="text-gray-500 mt-2">Loading tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-8 text-center">
            <ExclamationTriangleIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No support tickets found</p>
          </div>
        ) : (
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
                    Category
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
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {ticket.ticketNumber}
                      </div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {ticket.subject}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {ticket.user.profile
                          ? `${ticket.user.profile.firstName} ${ticket.user.profile.lastName}`
                          : ticket.user.name || "Unknown"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {ticket.user.email}
                      </div>
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          ticket.userType === "CAREGIVER"
                            ? "text-green-700 bg-green-100"
                            : "text-blue-700 bg-blue-100"
                        }`}
                      >
                        {ticket.userType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getCategoryLabel(ticket.category)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                          ticket.status
                        )}`}
                      >
                        {ticket.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(
                          ticket.priority
                        )}`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <button
                        onClick={() => fetchTicketDetails(ticket.id)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {showTicketModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedTicket.ticketNumber}
                </h3>
                <p className="text-sm text-gray-500">{selectedTicket.subject}</p>
              </div>
              <button
                onClick={() => {
                  setShowTicketModal(false);
                  setSelectedTicket(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Ticket Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    User
                  </label>
                  <p className="text-sm text-gray-900">
                    {selectedTicket.user.profile
                      ? `${selectedTicket.user.profile.firstName} ${selectedTicket.user.profile.lastName}`
                      : selectedTicket.user.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedTicket.user.email}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Category
                  </label>
                  <p className="text-sm text-gray-900">
                    {getCategoryLabel(selectedTicket.category)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Status
                  </label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) =>
                      updateTicketStatus(selectedTicket.id, e.target.value)
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="AWAITING_USER">Awaiting User</option>
                    <option value="AWAITING_ADMIN">Awaiting Admin</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    Priority
                  </label>
                  <select
                    value={selectedTicket.priority}
                    onChange={(e) =>
                      updateTicketPriority(selectedTicket.id, e.target.value)
                    }
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Original Description */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-500">
                  Description
                </label>
                <div className="mt-1 p-4 bg-gray-50 rounded-lg text-sm text-gray-900 whitespace-pre-wrap">
                  {selectedTicket.description}
                </div>
              </div>

              {/* Booking Info */}
              {selectedTicket.booking && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <label className="text-sm font-medium text-blue-700">
                    Related Booking
                  </label>
                  <p className="text-sm text-blue-900">
                    ID: {selectedTicket.booking.id}
                  </p>
                  <p className="text-sm text-blue-900">
                    Date: {formatDate(selectedTicket.booking.startTime)} -{" "}
                    {formatDate(selectedTicket.booking.endTime)}
                  </p>
                  <p className="text-sm text-blue-900">
                    Status: {selectedTicket.booking.status}
                  </p>
                </div>
              )}

              {/* Conversation Thread */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-500 mb-2 block">
                  Conversation
                </label>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {selectedTicket.responses.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">
                      No responses yet
                    </p>
                  ) : (
                    selectedTicket.responses.map((response) => (
                      <div
                        key={response.id}
                        className={`p-4 rounded-lg ${
                          response.isInternal
                            ? "bg-yellow-50 border border-yellow-200"
                            : response.responderId === selectedTicket.userId
                            ? "bg-gray-100"
                            : "bg-indigo-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {response.responderId === selectedTicket.userId
                              ? "User"
                              : "Admin"}
                            {response.isInternal && (
                              <span className="ml-2 text-xs text-yellow-600">
                                (Internal Note)
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(response.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {response.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Reply Form */}
              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">
                  Add Response
                </label>
                <textarea
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  placeholder="Type your response..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <div className="mt-2 flex items-center justify-between">
                  <label className="flex items-center text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    Internal note (not visible to user)
                  </label>
                  <button
                    onClick={sendResponse}
                    disabled={!newResponse.trim() || sendingResponse}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                    {sendingResponse ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-200 flex justify-between">
              <button
                onClick={() => {
                  const resolution = prompt("Enter resolution notes:");
                  if (resolution) {
                    resolveTicket(selectedTicket.id, resolution);
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <CheckCircleIcon className="h-4 w-4 inline mr-2" />
                Resolve Ticket
              </button>
              <button
                onClick={() => {
                  setShowTicketModal(false);
                  setSelectedTicket(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
