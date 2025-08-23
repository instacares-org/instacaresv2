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
  tips: number;
}

interface EarningsBreakdown {
  category: string;
  amount: number;
  color: string;
}

interface EarningsChartProps {
  period: 'week' | 'month' | 'quarter' | 'year';
  detailed?: boolean;
}

const EarningsChart: React.FC<EarningsChartProps> = ({ period, detailed = false }) => {
  const { theme } = useTheme();
  const [earningsData, setEarningsData] = useState<EarningsData[]>([]);
  const [earningsBreakdown, setEarningsBreakdown] = useState<EarningsBreakdown[]>([]);
  const [selectedView, setSelectedView] = useState<'trend' | 'breakdown' | 'hourly'>('trend');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEarningsData = async () => {
      setLoading(true);
      try {
        // Mock data based on period
        const mockData = generateMockData(period);
        setEarningsData(mockData.timeline);
        setEarningsBreakdown(mockData.breakdown);
      } catch (error) {
        console.error('Error fetching earnings data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEarningsData();
  }, [period]);

  const generateMockData = (period: string) => {
    const breakdown: EarningsBreakdown[] = [
      { category: 'Base Rate', amount: 2850, color: '#10B981' },
      { category: 'Tips', amount: 285, color: '#F59E0B' },
      { category: 'Bonuses', amount: 115.50, color: '#3B82F6' },
    ];

    let timeline: EarningsData[];
    
    switch (period) {
      case 'week':
        timeline = [
          { period: 'Mon', earnings: 125, hours: 5, bookings: 2, tips: 15 },
          { period: 'Tue', earnings: 200, hours: 8, bookings: 3, tips: 25 },
          { period: 'Wed', earnings: 150, hours: 6, bookings: 2, tips: 20 },
          { period: 'Thu', earnings: 175, hours: 7, bookings: 3, tips: 18 },
          { period: 'Fri', earnings: 225, hours: 9, bookings: 4, tips: 35 },
          { period: 'Sat', earnings: 300, hours: 12, bookings: 5, tips: 45 },
          { period: 'Sun', earnings: 275, hours: 11, bookings: 4, tips: 40 },
        ];
        break;
      case 'year':
        timeline = [
          { period: 'Jan', earnings: 2800, hours: 120, bookings: 45, tips: 280 },
          { period: 'Feb', earnings: 2650, hours: 110, bookings: 42, tips: 265 },
          { period: 'Mar', earnings: 3100, hours: 135, bookings: 52, tips: 310 },
          { period: 'Apr', earnings: 2950, hours: 125, bookings: 48, tips: 295 },
          { period: 'May', earnings: 3200, hours: 140, bookings: 55, tips: 320 },
          { period: 'Jun', earnings: 3450, hours: 150, bookings: 58, tips: 345 },
          { period: 'Jul', earnings: 3600, hours: 155, bookings: 62, tips: 360 },
          { period: 'Aug', earnings: 3250, hours: 145, bookings: 56, tips: 325 },
          { period: 'Sep', earnings: 3050, hours: 130, bookings: 50, tips: 305 },
          { period: 'Oct', earnings: 2900, hours: 125, bookings: 47, tips: 290 },
          { period: 'Nov', earnings: 2750, hours: 115, bookings: 44, tips: 275 },
          { period: 'Dec', earnings: 3100, hours: 135, bookings: 51, tips: 310 },
        ];
        break;
      default: // month or quarter
        timeline = [
          { period: 'Week 1', earnings: 850, hours: 35, bookings: 12, tips: 85 },
          { period: 'Week 2', earnings: 920, hours: 38, bookings: 14, tips: 92 },
          { period: 'Week 3', earnings: 780, hours: 32, bookings: 11, tips: 78 },
          { period: 'Week 4', earnings: 700, hours: 28, bookings: 10, tips: 70 },
        ];
    }

    return { timeline, breakdown };
  };

  const totalEarnings = earningsData.reduce((sum, item) => sum + item.earnings, 0);
  const totalHours = earningsData.reduce((sum, item) => sum + item.hours, 0);
  const averageHourlyRate = totalHours > 0 ? totalEarnings / totalHours : 0;

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

  const exportData = () => {
    const csvContent = [
      ['Period', 'Earnings', 'Hours', 'Bookings', 'Tips'],
      ...earningsData.map(item => [
        item.period,
        item.earnings.toString(),
        item.hours.toString(),
        item.bookings.toString(),
        item.tips.toString()
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
                  ${averageHourlyRate.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
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
                  formatter={(value: any, name: string) => [
                    name === 'earnings' ? `$${value}` : value,
                    name.charAt(0).toUpperCase() + name.slice(1)
                  ]}
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
                  dataKey="tips" 
                  stroke="#F59E0B" 
                  strokeWidth={2}
                  name="Tips"
                  dot={{ fill: '#F59E0B', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedView === 'breakdown' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={earningsBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, amount, percent }) => 
                    `${category}: $${amount} (${(percent * 100).toFixed(1)}%)`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
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
          </div>
        )}

        {selectedView === 'hourly' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={earningsData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis 
                  dataKey="period" 
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
                />
                <Legend />
                <Bar dataKey="hours" fill="#3B82F6" name="Hours Worked" />
                <Bar dataKey="bookings" fill="#10B981" name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default EarningsChart;