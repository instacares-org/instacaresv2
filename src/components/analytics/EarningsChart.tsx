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
  CurrencyDollarIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

interface EarningsData {
  period: string;
  earnings: number;
  hours: number;
  bookings: number;
}

interface EarningsBreakdown {
  name: string;
  value: number;
  color: string;
}

interface HourlyAnalysis {
  hour: string;
  bookings: number;
  avgRate: number;
  totalEarnings: number;
}

interface EarningsChartProps {
  period: 'week' | 'month' | 'quarter' | 'year';
  detailed?: boolean;
}

const EarningsChart: React.FC<EarningsChartProps> = ({ period, detailed = false }) => {
  const { theme } = useTheme();
  const [earningsData, setEarningsData] = useState<EarningsData[]>([]);
  const [earningsBreakdown, setEarningsBreakdown] = useState<EarningsBreakdown[]>([]);
  const [hourlyAnalysis, setHourlyAnalysis] = useState<HourlyAnalysis[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [avgHourlyRate, setAvgHourlyRate] = useState(0);
  const [selectedView, setSelectedView] = useState<'trend' | 'breakdown' | 'hourly'>('trend');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEarningsData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/caregiver/analytics?period=${period}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        const result = await response.json();

        if (result.success && result.data) {
          const { earnings } = result.data;
          setEarningsData(earnings.trend || []);
          setEarningsBreakdown(earnings.breakdown || []);
          setHourlyAnalysis(earnings.hourlyAnalysis || []);
          setTotalEarnings(earnings.total || 0);
          setTotalHours(earnings.totalHours || 0);
          setAvgHourlyRate(earnings.avgHourlyRate || 0);
        }
      } catch (err) {
        console.error('Error fetching earnings data:', err);
        setError('Unable to load earnings data');
      } finally {
        setLoading(false);
      }
    };

    fetchEarningsData();
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
          <CurrencyDollarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>{error}</p>
          <p className="text-sm mt-2">Complete some bookings to see your earnings analytics</p>
        </div>
      </div>
    );
  }

  const exportData = () => {
    const csvContent = [
      ['Period', 'Earnings', 'Hours', 'Bookings'],
      ...earningsData.map(item => [
        item.period,
        item.earnings.toString(),
        item.hours.toString(),
        item.bookings.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <CurrencyDollarIcon className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
              Earnings Analysis
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Track your income trends and performance
            </p>
          </div>

          {detailed && (
            <div className="flex items-center space-x-4">
              {/* View Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                {[
                  { key: 'trend', label: 'Trend' },
                  { key: 'breakdown', label: 'Breakdown' },
                  { key: 'hourly', label: 'Hourly' }
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
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <CurrencyDollarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Total Earnings</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  ${totalEarnings.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <CalendarDaysIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Hours</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {totalHours.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Avg Hourly Rate</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  ${avgHourlyRate.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
        {earningsData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <ChartBarIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No earnings data available for this period</p>
              <p className="text-sm mt-2">Complete bookings to see your earnings trend</p>
            </div>
          </div>
        ) : (
          <>
            {selectedView === 'trend' && (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={earningsData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis
                      dataKey="period"
                      stroke={chartTheme.text}
                      fontSize={12}
                    />
                    <YAxis
                      stroke={chartTheme.text}
                      fontSize={12}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartTheme.background,
                        border: `1px solid ${chartTheme.grid}`,
                        borderRadius: '8px',
                        color: chartTheme.text
                      }}
                      formatter={((value: any, name: string) => [
                        name === 'earnings' ? `$${value}` : value,
                        name.charAt(0).toUpperCase() + name.slice(1)
                      ]) as any}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="earnings"
                      stroke="#10B981"
                      strokeWidth={3}
                      name="Earnings"
                      dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="bookings"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      name="Bookings"
                      dot={{ fill: '#3B82F6', strokeWidth: 2, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {selectedView === 'breakdown' && (
              <div className="h-80">
                {earningsBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={earningsBreakdown as any[]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }: any) =>
                          `${name}: $${value} (${((percent ?? 0) * 100).toFixed(1)}%)`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {earningsBreakdown.map((entry, index) => (
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
                        formatter={(value: any) => [`$${value}`, 'Amount']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No breakdown data available
                  </div>
                )}
              </div>
            )}

            {selectedView === 'hourly' && (
              <div className="h-80">
                {hourlyAnalysis.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyAnalysis}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis
                        dataKey="hour"
                        stroke={chartTheme.text}
                        fontSize={12}
                      />
                      <YAxis
                        stroke={chartTheme.text}
                        fontSize={12}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: chartTheme.background,
                          border: `1px solid ${chartTheme.grid}`,
                          borderRadius: '8px',
                          color: chartTheme.text
                        }}
                        formatter={((value: any, name: string) => [
                          name === 'totalEarnings' || name === 'avgRate' ? `$${value}` : value,
                          name === 'totalEarnings' ? 'Total Earnings' :
                          name === 'avgRate' ? 'Avg per Booking' : 'Bookings'
                        ]) as any}
                      />
                      <Legend />
                      <Bar dataKey="bookings" fill="#3B82F6" name="Bookings" />
                      <Bar dataKey="avgRate" fill="#10B981" name="Avg per Booking" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No hourly data available
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default EarningsChart;
