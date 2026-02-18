"use client";

import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  UserGroupIcon,
  ChartBarIcon,
  HeartIcon,
  ArrowDownTrayIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

interface ClientSegment {
  name: string;
  value: number;
  color: string;
}

interface ClientRetentionProps {
  period: 'week' | 'month' | 'quarter' | 'year';
}

const ClientRetention: React.FC<ClientRetentionProps> = ({ period }) => {
  const { theme } = useTheme();
  const [totalClients, setTotalClients] = useState(0);
  const [newClients, setNewClients] = useState(0);
  const [returningClients, setReturningClients] = useState(0);
  const [retentionRate, setRetentionRate] = useState(0);
  const [churnRate, setChurnRate] = useState(0);
  const [avgLifetimeValue, setAvgLifetimeValue] = useState(0);
  const [clientSegments, setClientSegments] = useState<ClientSegment[]>([]);
  const [selectedView, setSelectedView] = useState<'overview' | 'segments' | 'lifetime'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRetentionData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/caregiver/analytics?period=${period}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        const result = await response.json();

        if (result.success && result.data) {
          const { retention } = result.data;
          setTotalClients(retention.totalClients || 0);
          setNewClients(retention.newClients || 0);
          setReturningClients(retention.returningClients || 0);
          setRetentionRate(retention.retentionRate || 0);
          setChurnRate(retention.churnRate || 0);
          setAvgLifetimeValue(retention.avgLifetimeValue || 0);
          setClientSegments(retention.segments || []);
        }
      } catch (err) {
        console.error('Error fetching retention data:', err);
        setError('Unable to load retention data');
      } finally {
        setLoading(false);
      }
    };

    fetchRetentionData();
  }, [period]);

  const chartTheme = {
    background: theme === 'dark' ? '#1F2937' : '#FFFFFF',
    text: theme === 'dark' ? '#F9FAFB' : '#1F2937',
    grid: theme === 'dark' ? '#374151' : '#E5E7EB',
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <UserGroupIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>{error}</p>
          <p className="text-sm mt-2">Complete some bookings to see client retention data</p>
        </div>
      </div>
    );
  }

  const exportData = () => {
    const csvContent = [
      ['Metric', 'Value'],
      ['Total Clients', totalClients.toString()],
      ['New Clients', newClients.toString()],
      ['Returning Clients', returningClients.toString()],
      ['Retention Rate', `${retentionRate}%`],
      ['Churn Rate', `${churnRate}%`],
      ['Avg Lifetime Value', `$${avgLifetimeValue}`],
      [''],
      ['Client Segments'],
      ...clientSegments.map(s => [s.name, s.value.toString()])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-retention-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate segment percentages for display
  const segmentsWithPercentage = clientSegments.map(s => ({
    ...s,
    percentage: totalClients > 0 ? Math.round((s.value / totalClients) * 100) : 0
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-2 text-pink-600 dark:text-pink-400" />
              Client Retention
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Monitor client loyalty and retention metrics
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* View Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'segments', label: 'Segments' },
                { key: 'lifetime', label: 'Lifetime' }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSelectedView(key as any)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition ${
                    selectedView === key
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Export Button */}
            <button
              onClick={exportData}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-pink-50 dark:bg-pink-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <UserGroupIcon className="h-8 w-8 text-pink-600 dark:text-pink-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-pink-600 dark:text-pink-400">Total Clients</p>
                <p className="text-2xl font-bold text-pink-700 dark:text-pink-300">
                  {totalClients}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <HeartIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Retention Rate</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {retentionRate}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Returning</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {returningClients}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <StarIcon className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">New Clients</p>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                  {newClients}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
        {totalClients === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <UserGroupIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No client data available for this period</p>
              <p className="text-sm mt-2">Complete bookings to build client relationships</p>
            </div>
          </div>
        ) : (
          <>
            {selectedView === 'overview' && (
              <div className="h-80">
                <div className="grid grid-cols-2 gap-8 h-full">
                  {/* Retention vs Churn */}
                  <div className="flex flex-col items-center justify-center">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                      Retention vs Churn
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Retained', value: retentionRate, color: '#10B981' },
                            { name: 'Churned', value: churnRate, color: '#EF4444' }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}%`}
                        >
                          <Cell fill="#10B981" />
                          <Cell fill="#EF4444" />
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: chartTheme.background,
                            border: `1px solid ${chartTheme.grid}`,
                            borderRadius: '8px',
                            color: chartTheme.text
                          }}
                          formatter={(value: any) => [`${value}%`, 'Rate']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* New vs Returning */}
                  <div className="flex flex-col items-center justify-center">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                      New vs Returning Clients
                    </h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={[
                          { name: 'New', value: newClients },
                          { name: 'Returning', value: returningClients }
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                        <XAxis dataKey="name" stroke={chartTheme.text} fontSize={12} />
                        <YAxis stroke={chartTheme.text} fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: chartTheme.background,
                            border: `1px solid ${chartTheme.grid}`,
                            borderRadius: '8px',
                            color: chartTheme.text
                          }}
                        />
                        <Bar dataKey="value" fill="#3B82F6" name="Clients" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {selectedView === 'segments' && (
              <div className="h-80">
                {clientSegments.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={segmentsWithPercentage}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }: any) =>
                          `${name}: ${percentage}%`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {clientSegments.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartTheme.background,
                          border: `1px solid ${chartTheme.grid}`,
                          borderRadius: '8px',
                          color: chartTheme.text
                        }}
                        formatter={(value: any) => [
                          `${value} clients`,
                          'Count'
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No segment data available
                  </div>
                )}
              </div>
            )}

            {selectedView === 'lifetime' && (
              <div className="h-80 flex flex-col items-center justify-center">
                <div className="text-center mb-8">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Average Client Lifetime Value
                  </h4>
                  <p className="text-4xl font-bold text-green-600 dark:text-green-400">
                    ${avgLifetimeValue.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Based on all-time completed bookings
                  </p>
                </div>

                {/* Client Value Distribution */}
                <div className="w-full max-w-md">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 text-center">
                    Client Distribution
                  </h4>
                  <div className="space-y-3">
                    {clientSegments.map((segment, index) => (
                      <div key={index} className="flex items-center">
                        <div
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: segment.color }}
                        />
                        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                          {segment.name}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {segment.value} clients
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ClientRetention;
