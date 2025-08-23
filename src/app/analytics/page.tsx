"use client";

import { useState, useEffect } from 'react';
import AdminAuthLayout from '@/components/AdminAuthLayout';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

export default function AnalyticsPage() {
  const [adminUserId, setAdminUserId] = useState<string | null>(null);

  // Function to extract admin user ID from the AdminAuthLayout
  const handleAuthSuccess = () => {
    // This will be called by AdminAuthLayout when auth is successful
    // We'll get the user ID from the session API response
    fetchAdminUserId();
  };

  const fetchAdminUserId = async () => {
    try {
      const response = await fetch('/api/admin/session');
      if (response.ok) {
        const data = await response.json();
        setAdminUserId(data.admin.id);
      }
    } catch (error) {
      console.error('Failed to get admin user ID:', error);
    }
  };

  useEffect(() => {
    // Try to get admin user ID on component mount
    fetchAdminUserId();
  }, []);

  return (
    <AdminAuthLayout title="Analytics Dashboard">
      <div className="container mx-auto px-4 py-8">
        {adminUserId ? (
          <AnalyticsDashboard adminUserId={adminUserId} />
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        )}
      </div>
    </AdminAuthLayout>
  );
}