"use client";

import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  DocumentTextIcon,
  CurrencyDollarIcon,
  ReceiptPercentIcon,
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  BanknotesIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

interface TaxData {
  period: string;
  grossIncome: number;
  businessExpenses: number;
  netIncome: number;
  estimatedTax: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  deductible: boolean;
}

interface QuarterlyTax {
  quarter: string;
  dueDate: string;
  estimatedAmount: number;
  paid: boolean;
  status: 'upcoming' | 'due' | 'paid' | 'overdue';
}

interface TaxReportsProps {
  period: 'week' | 'month' | 'quarter' | 'year';
}

const TaxReports: React.FC<TaxReportsProps> = ({ period }) => {
  const { theme } = useTheme();
  const [taxData, setTaxData] = useState<TaxData[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([]);
  const [quarterlyTaxes, setQuarterlyTaxes] = useState<QuarterlyTax[]>([]);
  const [selectedView, setSelectedView] = useState<'overview' | 'expenses' | 'quarterly'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTaxData = async () => {
      setLoading(true);
      try {
        // Mock data based on period
        const mockData = generateMockData(period);
        setTaxData(mockData.overview);
        setExpenseCategories(mockData.expenses);
        setQuarterlyTaxes(mockData.quarterly);
      } catch (error) {
        console.error('Error fetching tax data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTaxData();
  }, [period]);

  const generateMockData = (period: string) => {
    const expenses: ExpenseCategory[] = [
      { category: 'Transportation', amount: 850, percentage: 35, color: '#10B981', deductible: true },
      { category: 'Professional Development', amount: 420, percentage: 17, color: '#3B82F6', deductible: true },
      { category: 'Equipment & Supplies', amount: 320, percentage: 13, color: '#F59E0B', deductible: true },
      { category: 'Insurance', amount: 280, percentage: 12, color: '#8B5CF6', deductible: true },
      { category: 'Marketing & Advertising', amount: 250, percentage: 10, color: '#EF4444', deductible: true },
      { category: 'Phone & Internet', amount: 180, percentage: 7, color: '#EC4899', deductible: true },
      { category: 'Licensing & Certifications', amount: 150, percentage: 6, color: '#06B6D4', deductible: true },
    ];

    const quarterly: QuarterlyTax[] = [
      { quarter: 'Q1 2024', dueDate: 'April 15, 2024', estimatedAmount: 1250, paid: true, status: 'paid' },
      { quarter: 'Q2 2024', dueDate: 'June 17, 2024', estimatedAmount: 1380, paid: true, status: 'paid' },
      { quarter: 'Q3 2024', dueDate: 'September 16, 2024', estimatedAmount: 1420, paid: true, status: 'paid' },
      { quarter: 'Q4 2024', dueDate: 'January 15, 2025', estimatedAmount: 1350, paid: false, status: 'upcoming' },
    ];

    let overview: TaxData[];
    
    switch (period) {
      case 'week':
        overview = [
          { period: 'Mon', grossIncome: 200, businessExpenses: 35, netIncome: 165, estimatedTax: 41 },
          { period: 'Tue', grossIncome: 275, businessExpenses: 45, netIncome: 230, estimatedTax: 58 },
          { period: 'Wed', grossIncome: 225, businessExpenses: 40, netIncome: 185, estimatedTax: 46 },
          { period: 'Thu', grossIncome: 300, businessExpenses: 50, netIncome: 250, estimatedTax: 63 },
          { period: 'Fri', grossIncome: 350, businessExpenses: 55, netIncome: 295, estimatedTax: 74 },
          { period: 'Sat', grossIncome: 400, businessExpenses: 65, netIncome: 335, estimatedTax: 84 },
          { period: 'Sun', grossIncome: 325, businessExpenses: 50, netIncome: 275, estimatedTax: 69 },
        ];
        break;
      case 'year':
        overview = [
          { period: 'Jan', grossIncome: 4200, businessExpenses: 620, netIncome: 3580, estimatedTax: 895 },
          { period: 'Feb', grossIncome: 3800, businessExpenses: 580, netIncome: 3220, estimatedTax: 805 },
          { period: 'Mar', grossIncome: 4500, businessExpenses: 680, netIncome: 3820, estimatedTax: 955 },
          { period: 'Apr', grossIncome: 4100, businessExpenses: 640, netIncome: 3460, estimatedTax: 865 },
          { period: 'May', grossIncome: 4800, businessExpenses: 720, netIncome: 4080, estimatedTax: 1020 },
          { period: 'Jun', grossIncome: 5200, businessExpenses: 780, netIncome: 4420, estimatedTax: 1105 },
          { period: 'Jul', grossIncome: 5600, businessExpenses: 840, netIncome: 4760, estimatedTax: 1190 },
          { period: 'Aug', grossIncome: 5000, businessExpenses: 750, netIncome: 4250, estimatedTax: 1063 },
          { period: 'Sep', grossIncome: 4600, businessExpenses: 690, netIncome: 3910, estimatedTax: 978 },
          { period: 'Oct', grossIncome: 4300, businessExpenses: 650, netIncome: 3650, estimatedTax: 913 },
          { period: 'Nov', grossIncome: 4000, businessExpenses: 600, netIncome: 3400, estimatedTax: 850 },
          { period: 'Dec', grossIncome: 4700, businessExpenses: 710, netIncome: 3990, estimatedTax: 998 },
        ];
        break;
      default: // month or quarter
        overview = [
          { period: 'Week 1', grossIncome: 1200, businessExpenses: 180, netIncome: 1020, estimatedTax: 255 },
          { period: 'Week 2', grossIncome: 1350, businessExpenses: 200, netIncome: 1150, estimatedTax: 288 },
          { period: 'Week 3', grossIncome: 1100, businessExpenses: 165, netIncome: 935, estimatedTax: 234 },
          { period: 'Week 4', grossIncome: 1450, businessExpenses: 220, netIncome: 1230, estimatedTax: 308 },
        ];
    }

    return { overview, expenses, quarterly };
  };

  const totalGrossIncome = taxData.reduce((sum, item) => sum + item.grossIncome, 0);
  const totalExpenses = taxData.reduce((sum, item) => sum + item.businessExpenses, 0);
  const totalNetIncome = taxData.reduce((sum, item) => sum + item.netIncome, 0);
  const totalEstimatedTax = taxData.reduce((sum, item) => sum + item.estimatedTax, 0);

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

  const exportTaxReport = () => {
    let csvContent = '';
    
    if (selectedView === 'overview') {
      csvContent = [
        ['Period', 'Gross Income', 'Business Expenses', 'Net Income', 'Estimated Tax'],
        ...taxData.map(item => [
          item.period,
          item.grossIncome.toString(),
          item.businessExpenses.toString(),
          item.netIncome.toString(),
          item.estimatedTax.toString()
        ])
      ].map(row => row.join(',')).join('\n');
    } else if (selectedView === 'expenses') {
      csvContent = [
        ['Category', 'Amount', 'Percentage', 'Deductible'],
        ...expenseCategories.map(item => [
          item.category,
          item.amount.toString(),
          item.percentage.toString(),
          item.deductible.toString()
        ])
      ].map(row => row.join(',')).join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${selectedView}-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generate1099Report = () => {
    const report1099 = {
      taxYear: new Date().getFullYear() - 1,
      totalIncome: totalGrossIncome,
      totalExpenses: totalExpenses,
      netIncome: totalNetIncome,
      estimatedTax: totalEstimatedTax,
      generatedDate: new Date().toISOString()
    };

    const reportContent = `
1099-NEC Tax Report
Tax Year: ${report1099.taxYear}
Generated: ${new Date().toLocaleDateString()}

INCOME SUMMARY:
Total Gross Income: $${report1099.totalIncome.toLocaleString()}
Total Business Expenses: $${report1099.totalExpenses.toLocaleString()}
Net Business Income: $${report1099.netIncome.toLocaleString()}
Estimated Tax Liability: $${report1099.estimatedTax.toLocaleString()}

EXPENSE BREAKDOWN:
${expenseCategories.map(exp => 
  `${exp.category}: $${exp.amount.toLocaleString()} (${exp.deductible ? 'Deductible' : 'Non-deductible'})`
).join('\n')}

Note: This is an estimated report for tax planning purposes. 
Consult with a tax professional for official filing.
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `1099-report-${new Date().getFullYear() - 1}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getQuarterlyStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      case 'upcoming': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20';
      case 'due': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'overdue': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <DocumentTextIcon className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
              Tax Reports
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Generate tax documents and track deductible expenses
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* View Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'expenses', label: 'Expenses' },
                { key: 'quarterly', label: 'Quarterly' }
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

            {/* Export Buttons */}
            <button
              onClick={exportTaxReport}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export CSV
            </button>
            
            <button
              onClick={generate1099Report}
              className="flex items-center px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
            >
              <ClipboardDocumentListIcon className="h-4 w-4 mr-2" />
              1099 Report
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <CurrencyDollarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Gross Income</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  ${totalGrossIncome.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <ReceiptPercentIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">Business Expenses</p>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  ${totalExpenses.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <BanknotesIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Net Income</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                  ${totalNetIncome.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <DocumentTextIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              <div className="ml-4">
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Estimated Tax</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  ${totalEstimatedTax.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="p-6">
        {selectedView === 'overview' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taxData}>
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
                  formatter={(value: any) => [`$${value}`, '']}
                />
                <Legend />
                <Bar dataKey="grossIncome" fill="#10B981" name="Gross Income" />
                <Bar dataKey="businessExpenses" fill="#EF4444" name="Business Expenses" />
                <Bar dataKey="netIncome" fill="#3B82F6" name="Net Income" />
                <Bar dataKey="estimatedTax" fill="#8B5CF6" name="Estimated Tax" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedView === 'expenses' && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseCategories}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percentage }) => 
                    `${category}: ${percentage}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {expenseCategories.map((entry, index) => (
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

        {selectedView === 'quarterly' && (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quarterly Tax Payments
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quarterlyTaxes.map((quarter, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900 dark:text-white">
                      {quarter.quarter}
                    </h5>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getQuarterlyStatusColor(quarter.status)}`}>
                      {quarter.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <p>Due Date: {quarter.dueDate}</p>
                    <p>Amount: ${quarter.estimatedAmount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaxReports;