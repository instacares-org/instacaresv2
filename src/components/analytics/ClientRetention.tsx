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
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { 
  UserGroupIcon,
  ChartBarIcon,
  HeartIcon,
  ArrowDownTrayIcon,
  ClockIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

interface RetentionData {
  period: string;
  newClients: number;
  returningClients: number;
  retentionRate: number;
  churnRate: number;
}

interface ClientSegment {
  segment: string;
  count: number;
  percentage: number;
  revenue: number;
  color: string;
}

interface ClientLifetime {
  clientType: string;
  averageLifetime: number;
  totalValue: number;
  bookingsCount: number;
}

interface ClientRetentionProps {
  period: 'week' | 'month' | 'quarter' | 'year';
}

const ClientRetention: React.FC<ClientRetentionProps> = ({ period }) => {
  const { theme } = useTheme();
  const [retentionData, setRetentionData] = useState<RetentionData[]>([]);
  const [clientSegments, setClientSegments] = useState<ClientSegment[]>([]);
  const [lifetimeData, setLifetimeData] = useState<ClientLifetime[]>([]);
  const [selectedView, setSelectedView] = useState<'trends' | 'segments' | 'lifetime'>('trends');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRetentionData = async () => {
      setLoading(true);
      try {
        // Mock data based on period
        const mockData = generateMockData(period);
        setRetentionData(mockData.trends);
        setClientSegments(mockData.segments);
        setLifetimeData(mockData.lifetime);
      } catch (error) {
        console.error('Error fetching retention data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRetentionData();
  }, [period]);

  const generateMockData = (period: string) => {
    const segments: ClientSegment[] = [
      { segment: 'VIP Clients', count: 15, percentage: 25, revenue: 4500, color: '#10B981' },
      { segment: 'Regular Clients', count: 28, percentage: 47, revenue: 6720, color: '#3B82F6' },
      { segment: 'Occasional Clients', count: 12, percentage: 20, revenue: 1800, color: '#F59E0B' },
      { segment: 'New Clients', count: 5, percentage: 8, revenue: 500, color: '#8B5CF6' },
    ];

    const lifetime: ClientLifetime[] = [
      { clientType: 'VIP Clients', averageLifetime: 18, totalValue: 2250, bookingsCount: 45 },
      { clientType: 'Regular Clients', averageLifetime: 12, totalValue: 1200, bookingsCount: 24 },
      { clientType: 'Occasional Clients', averageLifetime: 6, totalValue: 450, bookingsCount: 9 },
      { clientType: 'New Clients', averageLifetime: 2, totalValue: 150, bookingsCount: 3 },
    ];

    let trends: RetentionData[];
    
    switch (period) {
      case 'week':
        trends = [
          { period: 'Mon', newClients: 2, returningClients: 8, retentionRate: 85, churnRate: 5 },
          { period: 'Tue', newClients: 1, returningClients: 9, retentionRate: 87, churnRate: 4 },
          { period: 'Wed', newClients: 3, returningClients: 7, retentionRate: 82, churnRate: 6 },
          { period: 'Thu', newClients: 2, returningClients: 8, retentionRate: 85, churnRate: 5 },
          { period: 'Fri', newClients: 4, returningClients: 11, retentionRate: 88, churnRate: 3 },
          { period: 'Sat', newClients: 5, returningClients: 12, retentionRate: 90, churnRate: 2 },
          { period: 'Sun', newClients: 3, returningClients: 10, retentionRate: 86, churnRate: 4 },
        ];
        break;
      case 'year':
        trends = [
          { period: 'Jan', newClients: 12, returningClients: 45, retentionRate: 78, churnRate: 8 },
          { period: 'Feb', newClients: 8, returningClients: 48, retentionRate: 82, churnRate: 6 },
          { period: 'Mar', newClients: 15, returningClients: 52, retentionRate: 85, churnRate: 5 },
          { period: 'Apr', newClients: 10, returningClients: 50, retentionRate: 83, churnRate: 7 },
          { period: 'May', newClients: 18, returningClients: 55, retentionRate: 87, churnRate: 4 },
          { period: 'Jun', newClients: 22, returningClients: 58, retentionRate: 89, churnRate: 3 },
          { period: 'Jul', newClients: 25, returningClients: 62, retentionRate: 91, churnRate: 2 },
          { period: 'Aug', newClients: 20, returningClients: 60, retentionRate: 88, churnRate: 4 },
          { period: 'Sep', newClients: 16, returningClients: 57, retentionRate: 86, churnRate: 5 },
          { period: 'Oct', newClients: 14, returningClients: 54, retentionRate: 84, churnRate: 6 },
          { period: 'Nov', newClients: 12, returningClients: 52, retentionRate: 82, churnRate: 7 },
          { period: 'Dec', newClients: 18, returningClients: 56, retentionRate: 85, churnRate: 5 },
        ];
        break;
      default: // month or quarter
        trends = [
          { period: 'Week 1', newClients: 8, returningClients: 22, retentionRate: 82, churnRate: 6 },
          { period: 'Week 2', newClients: 6, returningClients: 25, retentionRate: 85, churnRate: 5 },
          { period: 'Week 3', newClients: 4, returningClients: 28, retentionRate: 88, churnRate: 4 },
          { period: 'Week 4', newClients: 7, returningClients: 30, retentionRate: 86, churnRate: 5 },
        ];
    }

    return { trends, segments, lifetime };
  };

  const totalClients = retentionData.reduce((sum, item) => sum + item.newClients + item.returningClients, 0);
  const totalNewClients = retentionData.reduce((sum, item) => sum + item.newClients, 0);
  const totalReturningClients = retentionData.reduce((sum, item) => sum + item.returningClients, 0);
  const averageRetentionRate = retentionData.length > 0 
    ? retentionData.reduce((sum, item) => sum + item.retentionRate, 0) / retentionData.length 
    : 0;

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
      ['Period', 'New Clients', 'Returning Clients', 'Retention Rate', 'Churn Rate'],
      ...retentionData.map(item => [
        item.period,
        item.newClients.toString(),
        item.returningClients.toString(),
        item.retentionRate.toString(),
        item.churnRate.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `client-retention-${period}-${new Date().toISOString().split('T')[0]}.csv`;
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
                { key: 'trends', label: 'Trends' },
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
                  {averageRetentionRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Returning Clients</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  {totalReturningClients}
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
                  {totalNewClients}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
        {selectedView === 'trends' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={retentionData}>
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
                <Line 
                  type="monotone" 
                  dataKey="retentionRate" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  name="Retention Rate (%)"
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="churnRate" 
                  stroke="#EF4444" 
                  strokeWidth={2}
                  name="Churn Rate (%)"
                  dot={{ fill: '#EF4444', strokeWidth: 2, r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedView === 'segments' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={clientSegments}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ segment, percentage }) => 
                    `${segment}: ${percentage}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
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
                  formatter={(value: any, name: string) => [
                    `${value} clients`,
                    'Count'
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedView === 'lifetime' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lifetimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis 
                  dataKey="clientType" 
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
                <Bar dataKey="averageLifetime" fill="#3B82F6" name="Avg Lifetime (months)" />
                <Bar dataKey="totalValue" fill="#10B981" name="Total Value ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientRetention;