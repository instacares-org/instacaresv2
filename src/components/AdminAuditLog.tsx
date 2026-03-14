"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface AuditLogEntry {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Pagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  USER_APPROVED: { label: "User Approved", color: "bg-green-100 text-green-800" },
  USER_REJECTED: { label: "User Rejected", color: "bg-red-100 text-red-800" },
  USER_SUSPENDED: { label: "User Suspended", color: "bg-orange-100 text-orange-800" },
  USER_STATUS_CHANGED: { label: "User Status Changed", color: "bg-blue-100 text-blue-800" },
  USER_PASSWORD_RESET: { label: "Password Reset", color: "bg-yellow-100 text-yellow-800" },
  SETTINGS_UPDATED: { label: "Settings Updated", color: "bg-purple-100 text-purple-800" },
  CHAT_FLAGGED: { label: "Chat Flagged", color: "bg-red-100 text-red-800" },
  CHAT_NOTICE_SENT: { label: "Chat Notice", color: "bg-blue-100 text-blue-800" },
  CHAT_BULK_ACTION: { label: "Bulk Chat Action", color: "bg-indigo-100 text-indigo-800" },
  CAREGIVER_WARNING_ISSUED: { label: "Warning Issued", color: "bg-orange-100 text-orange-800" },
  CAREGIVER_DETAILED_APPROVAL: { label: "Caregiver Reviewed", color: "bg-green-100 text-green-800" },
  PAYOUT_PROCESSED: { label: "Payout Processed", color: "bg-emerald-100 text-emerald-800" },
  EXTENSION_APPROVED: { label: "Extension Decision", color: "bg-blue-100 text-blue-800" },
  EXTENSION_REFUNDED: { label: "Extension Refunded", color: "bg-red-100 text-red-800" },
  BABYSITTER_STATUS_CHANGED: { label: "Babysitter Status", color: "bg-blue-100 text-blue-800" },
  VERIFICATION_UPDATED: { label: "Verification Updated", color: "bg-teal-100 text-teal-800" },
  REVIEW_MODERATED: { label: "Review Moderated", color: "bg-purple-100 text-purple-800" },
  LOGIN_SUCCESS: { label: "Login Success", color: "bg-green-100 text-green-800" },
  LOGIN_FAILED: { label: "Login Failed", color: "bg-red-100 text-red-800" },
  LOGIN_RATE_LIMITED: { label: "Rate Limited", color: "bg-red-100 text-red-800" },
  SUSPICIOUS_ACTIVITY: { label: "Suspicious Activity", color: "bg-red-100 text-red-800" },
  SESSION_INVALIDATED: { label: "Session Invalidated", color: "bg-orange-100 text-orange-800" },
};

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, limit: 30, offset: 0, hasMore: false });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchLogs = useCallback(async (offset = 0) => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "30");
      params.set("offset", offset.toString());
      if (actionFilter) params.set("action", actionFilter);
      if (resourceFilter) params.set("resource", resourceFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(`/api/admin/audit-logs?${params}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch audit logs");

      const data = await response.json();
      setLogs(data.data?.logs || data.logs || []);
      setPagination(data.data?.pagination || data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  }, [actionFilter, resourceFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const getActionBadge = (action: string) => {
    const config = ACTION_LABELS[action] || { label: action, color: "bg-gray-100 text-gray-800" };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const allActions = Object.keys(ACTION_LABELS);
  const allResources = ["user", "settings", "chatRoom", "caregiver", "babysitter", "bookingExtension", "auth"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <ShieldCheckIcon className="h-8 w-8 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
            <p className="text-sm text-gray-500">
              {pagination.total} total entries
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ${
              showFilters ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            <FunnelIcon className="h-4 w-4 mr-1.5" />
            Filters
          </button>
          <button
            onClick={() => fetchLogs(0)}
            className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full rounded-md border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Actions</option>
                {allActions.map((a) => (
                  <option key={a} value={a}>{ACTION_LABELS[a].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Resource</label>
              <select
                value={resourceFilter}
                onChange={(e) => setResourceFilter(e.target.value)}
                className="w-full rounded-md border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Resources</option>
                {allResources.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-md border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-md border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => { setActionFilter(""); setResourceFilter(""); setDateFrom(""); setDateTo(""); }}
              className="text-sm text-gray-500 hover:text-gray-700 mr-3"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center text-red-700">
          <ExclamationTriangleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mx-auto mb-3"></div>
                    <p className="text-gray-500 text-sm">Loading audit logs...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No audit log entries found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {log.adminEmail}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      <span className="font-mono text-xs">{log.resource}</span>
                      {log.resourceId && (
                        <span className="ml-1 text-gray-400 font-mono text-xs" title={log.resourceId}>
                          #{log.resourceId.substring(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap font-mono text-xs">
                      {log.ipAddress || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {log.details ? (
                        <button
                          onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                        >
                          {expandedRow === log.id ? "Hide" : "View"}
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                      {expandedRow === log.id && log.details && (
                        <div className="mt-2 p-3 bg-gray-50 rounded-md text-xs">
                          <pre className="whitespace-pre-wrap text-gray-700 font-mono">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {pagination.offset + 1}–{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
            </div>
            <div className="flex space-x-2">
              <button
                disabled={pagination.offset === 0}
                onClick={() => fetchLogs(Math.max(0, pagination.offset - pagination.limit))}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                disabled={!pagination.hasMore}
                onClick={() => fetchLogs(pagination.offset + pagination.limit)}
                className="px-3 py-1.5 text-sm font-medium rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
