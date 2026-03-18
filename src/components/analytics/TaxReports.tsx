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
  Cell
} from 'recharts';
import {
  DocumentTextIcon,
  CurrencyDollarIcon,
  ReceiptPercentIcon,
  ArrowDownTrayIcon,
  BanknotesIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

interface QuarterlyData {
  quarter: string;
  income: number;
  expenses: number;
}

interface QuarterlyTax {
  quarter: string;
  dueDate: string;
  estimatedAmount: number;
  paid: boolean;
  status: 'upcoming' | 'due' | 'paid' | 'overdue';
}

interface ExpenseBreakdown {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  deductible: boolean;
}

interface TaxReportsProps {
  period: 'week' | 'month' | 'quarter' | 'year';
}

const TaxReports: React.FC<TaxReportsProps> = ({ period }) => {
  const { theme } = useTheme();
  const [grossIncome, setGrossIncome] = useState(0);
  const [platformFees, setPlatformFees] = useState(0);
  const [netIncome, setNetIncome] = useState(0);
  const [estimatedTax, setEstimatedTax] = useState(0);
  const [quarterlyData, setQuarterlyData] = useState<QuarterlyData[]>([]);
  const [quarterlyTaxes, setQuarterlyTaxes] = useState<QuarterlyTax[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<ExpenseBreakdown[]>([]);
  const [selectedView, setSelectedView] = useState<'overview' | 'expenses' | 'quarterly'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    const fetchTaxData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/caregiver/analytics?period=${period}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        const result = await response.json();

        if (result.success && result.data) {
          const { financial } = result.data;
          setGrossIncome(financial.grossIncome || 0);
          setPlatformFees(financial.platformFees || 0);
          setNetIncome(financial.netIncome || 0);
          setEstimatedTax(financial.estimatedTax || 0);
          setQuarterlyData(financial.quarterlyData || []);

          // Generate quarterly tax payment schedule based on quarterly data
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth();

          const quarterlyTaxSchedule: QuarterlyTax[] = (financial.quarterlyData || []).map((q: QuarterlyData, index: number) => {
            const quarterDueDates = [
              `April 15, ${currentYear}`,
              `June 17, ${currentYear}`,
              `September 16, ${currentYear}`,
              `January 15, ${currentYear + 1}`
            ];

            // Determine status based on current date
            let status: 'upcoming' | 'due' | 'paid' | 'overdue' = 'upcoming';

            if (index < Math.floor(currentMonth / 3)) {
              status = 'paid'; // Past quarters assumed paid
            } else if (index === Math.floor(currentMonth / 3)) {
              status = 'due';
            }

            return {
              quarter: q.quarter,
              dueDate: quarterDueDates[index],
              estimatedAmount: Math.round(q.income * 0.25), // 25% estimate
              paid: status === 'paid',
              status
            };
          });

          setQuarterlyTaxes(quarterlyTaxSchedule);

          // Create expense breakdown from platform fees
          const totalFees = financial.platformFees || 0;
          setExpenseBreakdown([
            {
              category: 'Platform Fees',
              amount: totalFees,
              percentage: 100,
              color: '#EF4444',
              deductible: true
            }
          ]);
        }
      } catch (err) {
        console.error('Error fetching tax data:', err);
        setError('Unable to load tax data');
      } finally {
        setLoading(false);
      }
    };

    fetchTaxData();
  }, [period]);

  // Use actual values from API
  const totalGrossIncome = grossIncome;
  const totalExpenses = platformFees;
  const totalNetIncome = netIncome;
  const totalEstimatedTax = estimatedTax;

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
          <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>{error}</p>
          <p className="text-sm mt-2">Complete some bookings to see your tax reports</p>
        </div>
      </div>
    );
  }

  const exportTaxReport = () => {
    let csvContent = '';

    if (selectedView === 'overview') {
      csvContent = [
        ['Quarter', 'Income', 'Expenses', 'Net Income', 'Estimated Tax'],
        ...quarterlyData.map(item => [
          item.quarter,
          item.income.toString(),
          item.expenses.toString(),
          (item.income - item.expenses).toString(),
          Math.round(item.income * 0.25).toString()
        ])
      ].map(row => row.join(',')).join('\n');
    } else if (selectedView === 'expenses') {
      csvContent = [
        ['Category', 'Amount', 'Percentage', 'Deductible'],
        ...expenseBreakdown.map(item => [
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

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Elegant color palette - soft, muted tones inspired by professional documents
  type RGB = [number, number, number];
  const colors: Record<string, RGB> = {
    primary: [103, 126, 167],
    primaryLight: [236, 240, 247],
    secondary: [134, 160, 134],
    secondaryLight: [240, 247, 240],
    accent: [180, 142, 142],
    accentLight: [250, 245, 245],
    warning: [199, 171, 118],
    warningLight: [253, 250, 243],
    text: [64, 64, 64],
    textLight: [128, 128, 128],
    border: [220, 220, 220],
    background: [250, 251, 252],
  };

  const generateT2125PDF = async () => {
    setGeneratingPdf(true);

    try {
      // Dynamically import jsPDF to avoid SSR issues
      // @ts-ignore - jspdf types may not be installed
      const { default: jsPDF } = await import('jspdf');
      // @ts-ignore - jspdf-autotable types may not be installed
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      const taxYear = new Date().getFullYear() - 1;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = 20;

      // Add InstaCares logo - fetch at runtime for reliable PDF generation
      let logoLoaded = false;

      try {
        // Fetch the optimized logo from the server
        const logoUrl = '/logo-optimized.png';
        const response = await fetch(logoUrl);

        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();

          const logoDataUrl = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          // Logo dimensions: 800x723 (width x height ratio ~1.1)
          const logoWidth = 35;
          const logoHeight = logoWidth * 0.9; // Approximate aspect ratio
          doc.addImage(
            logoDataUrl,
            'PNG',
            margin,
            8,
            logoWidth,
            logoHeight
          );
          logoLoaded = true;
        }
      } catch (logoErr) {
        console.warn('Logo loading failed, continuing without logo:', logoErr);
      }

      // Helper function to add elegant section header
      const addSectionHeader = (text: string, y: number) => {
        // Soft gradient-like header with rounded corners
        doc.setFillColor(...colors.primaryLight);
        doc.roundedRect(margin, y - 6, pageWidth - 2 * margin, 10, 2, 2, 'F');

        // Left accent bar
        doc.setFillColor(...colors.primary);
        doc.roundedRect(margin, y - 6, 4, 10, 1, 1, 'F');

        doc.setTextColor(...colors.primary);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(text, margin + 8, y + 1);
        doc.setTextColor(...colors.text);
        return y + 12;
      };

      // Elegant header background
      doc.setFillColor(...colors.background);
      doc.rect(0, 0, pageWidth, 50, 'F');

      // Subtle top border accent
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, 3, 'F');

      // Document title area (right side if logo loaded, otherwise centered)
      const titleX = logoLoaded ? pageWidth - margin : pageWidth / 2;
      const titleAlign = logoLoaded ? 'right' : 'center';

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.primary);
      doc.text('Self-Employment Income Statement', titleX, 22, { align: titleAlign as any });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.textLight);
      doc.text('Canadian Tax Filing Document (T2125)', titleX, 30, { align: titleAlign as any });

      // Tax year and date in elegant badges
      doc.setFontSize(9);
      doc.setFillColor(...colors.primaryLight);

      const badgeY = 38;
      const badge1X = logoLoaded ? pageWidth - margin - 70 : pageWidth / 2 - 35;
      const badge2X = logoLoaded ? pageWidth - margin - 35 : pageWidth / 2 + 5;

      doc.roundedRect(badge1X, badgeY - 4, 32, 8, 2, 2, 'F');
      doc.roundedRect(badge2X, badgeY - 4, 32, 8, 2, 2, 'F');

      doc.setTextColor(...colors.primary);
      doc.setFont('helvetica', 'bold');
      doc.text(`Tax Year: ${taxYear}`, badge1X + 16, badgeY + 1, { align: 'center' });
      doc.text(new Date().toLocaleDateString('en-CA'), badge2X + 16, badgeY + 1, { align: 'center' });

      yPos = 58;

      // Decorative line
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.5);
      doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);

      yPos += 5;

      // Business Information Section
      yPos = addSectionHeader('Business Information', yPos);

      doc.setFontSize(9);
      doc.setTextColor(...colors.text);

      const businessInfo = [
        ['Business Type', 'Childcare Services (Self-Employed)'],
        ['Industry Code', '624410 - Child Day Care Services'],
        ['Tax Form', 'T2125 - Statement of Business or Professional Activities'],
        ['Fiscal Period', `January 1, ${taxYear} - December 31, ${taxYear}`]
      ];

      businessInfo.forEach((row, index) => {
        const rowY = yPos + (index * 6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.textLight);
        doc.text(row[0] + ':', margin + 2, rowY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.text);
        doc.text(row[1], margin + 40, rowY);
      });

      yPos += 32;

      // Income Summary Section
      yPos = addSectionHeader('Income Summary', yPos);

      autoTable(doc, {
        startY: yPos,
        head: [['Description', 'Amount (CAD)']],
        body: [
          ['Gross Business Income', formatCurrency(totalGrossIncome)],
        ],
        theme: 'plain',
        headStyles: {
          fillColor: colors.secondaryLight,
          textColor: colors.secondary,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 4,
          textColor: colors.text
        },
        alternateRowStyles: {
          fillColor: [255, 255, 255]
        },
        styles: {
          lineColor: colors.border,
          lineWidth: 0.3
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 50, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      // Business Expenses Section
      yPos = addSectionHeader('Business Expenses (Deductible)', yPos);

      const expenseRows = expenseBreakdown.map(exp => [
        exp.category,
        formatCurrency(exp.amount),
        exp.deductible ? 'Yes' : 'No'
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Expense Category', 'Amount (CAD)', 'Deductible']],
        body: expenseRows,
        foot: [['Total Business Expenses', formatCurrency(totalExpenses), '']],
        theme: 'plain',
        headStyles: {
          fillColor: colors.accentLight,
          textColor: colors.accent,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 4,
          textColor: colors.text
        },
        footStyles: {
          fillColor: colors.accentLight,
          textColor: colors.accent,
          fontStyle: 'bold',
          fontSize: 9
        },
        styles: {
          lineColor: colors.border,
          lineWidth: 0.3
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 45, halign: 'right' },
          2: { cellWidth: 30, halign: 'center' }
        },
        margin: { left: margin, right: margin }
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      // Net Income Section
      yPos = addSectionHeader('Net Business Income', yPos);

      autoTable(doc, {
        startY: yPos,
        head: [['Calculation', 'Amount (CAD)']],
        body: [
          ['Gross Business Income', formatCurrency(totalGrossIncome)],
          ['Less: Business Expenses', `(${formatCurrency(totalExpenses)})`],
        ],
        foot: [['Net Self-Employment Income', formatCurrency(totalNetIncome)]],
        theme: 'plain',
        headStyles: {
          fillColor: colors.secondaryLight,
          textColor: colors.secondary,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 4,
          textColor: colors.text
        },
        footStyles: {
          fillColor: [232, 245, 233], // Soft green highlight
          textColor: [56, 118, 64],   // Dark green
          fontStyle: 'bold',
          fontSize: 10
        },
        styles: {
          lineColor: colors.border,
          lineWidth: 0.3
        },
        columnStyles: {
          0: { cellWidth: 100 },
          1: { cellWidth: 50, halign: 'right' }
        },
        margin: { left: margin, right: margin }
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      // Estimated Tax Liability Section
      yPos = addSectionHeader('Estimated Tax Liability', yPos);

      const cppContributions = Math.round(totalNetIncome * 0.119);

      autoTable(doc, {
        startY: yPos,
        head: [['Tax Component', 'Rate', 'Amount (CAD)']],
        body: [
          ['Estimated Income Tax', '~25%', formatCurrency(totalEstimatedTax)],
          ['CPP Contributions (Self-Employed)', '~11.9%', formatCurrency(cppContributions)],
        ],
        foot: [['Total Estimated Tax Liability', '', formatCurrency(totalEstimatedTax + cppContributions)]],
        theme: 'plain',
        headStyles: {
          fillColor: colors.warningLight,
          textColor: colors.warning,
          fontStyle: 'bold',
          fontSize: 9,
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 4,
          textColor: colors.text
        },
        footStyles: {
          fillColor: [255, 243, 224], // Soft amber highlight
          textColor: [180, 120, 60],   // Dark amber
          fontStyle: 'bold',
          fontSize: 10
        },
        styles: {
          lineColor: colors.border,
          lineWidth: 0.3
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 30, halign: 'center' },
          2: { cellWidth: 45, halign: 'right' }
        },
        margin: { left: margin, right: margin }
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;

      // Quarterly Breakdown Section
      if (quarterlyData.length > 0 && quarterlyData.some(q => q.income > 0)) {
        yPos = addSectionHeader('Quarterly Income Breakdown', yPos);

        const quarterRows = quarterlyData.map(q => [
          q.quarter,
          formatCurrency(q.income),
          formatCurrency(q.expenses),
          formatCurrency(q.income - q.expenses)
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Quarter', 'Income', 'Expenses', 'Net Income']],
          body: quarterRows,
          theme: 'plain',
          headStyles: {
            fillColor: colors.primaryLight,
            textColor: colors.primary,
            fontStyle: 'bold',
            fontSize: 9,
            cellPadding: 4
          },
          bodyStyles: {
            fontSize: 9,
            cellPadding: 4,
            textColor: colors.text
          },
          alternateRowStyles: {
            fillColor: [252, 252, 253]
          },
          styles: {
            lineColor: colors.border,
            lineWidth: 0.3
          },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 40, halign: 'right' },
            2: { cellWidth: 40, halign: 'right' },
            3: { cellWidth: 40, halign: 'right' }
          },
          margin: { left: margin, right: margin }
        });

        yPos = (doc as any).lastAutoTable.finalY + 12;
      }

      // Check if we need a new page for the notes section
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      // Important Notes Section
      yPos = addSectionHeader('Important Canadian Tax Filing Reminders', yPos);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...colors.text);

      const notes = [
        { num: '1', text: 'Report this income on Form T2125 (Statement of Business or Professional Activities)' },
        { num: '2', text: 'Attach this statement to your T1 Personal Income Tax Return' },
        { num: '3', text: 'Keep all receipts and records for at least 6 years' },
        { num: '4', text: 'GST/HST Registration: Required if gross revenue exceeds $30,000 in four consecutive quarters' },
        { num: '5', text: 'Quarterly Tax Instalments: May be required if you owe more than $3,000 in taxes' },
        { num: '6', text: 'Filing Deadlines: April 30 (tax payment) / June 15 (self-employed return)' },
        { num: '7', text: 'Self-employed individuals pay both employer and employee portions of CPP' }
      ];

      notes.forEach((note, index) => {
        const noteY = yPos + (index * 5.5);
        doc.setTextColor(...colors.primary);
        doc.setFont('helvetica', 'bold');
        doc.text(note.num + '.', margin + 2, noteY);
        doc.setTextColor(...colors.text);
        doc.setFont('helvetica', 'normal');
        doc.text(note.text, margin + 8, noteY);
      });

      yPos += notes.length * 5.5 + 8;

      // Elegant Disclaimer Box
      doc.setFillColor(255, 251, 235); // Very soft cream
      doc.setDrawColor(...colors.warning);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 22, 3, 3, 'FD');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.warning);
      doc.text('DISCLAIMER', margin + 4, yPos + 6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(140, 120, 80);
      doc.text(
        'This document is for tax planning purposes only. The figures provided are estimates based on your InstaCares earnings.',
        margin + 4, yPos + 12
      );
      doc.text(
        'Please consult a certified Canadian tax professional or accountant for official filing and personalized advice.',
        margin + 4, yPos + 17
      );

      // Elegant Footer
      const footerY = pageHeight - 12;

      // Footer line
      doc.setDrawColor(...colors.border);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);

      doc.setFontSize(7);
      doc.setTextColor(...colors.textLight);
      doc.text('InstaCares - Professional Childcare Platform', margin, footerY);
      doc.text('www.instacares.com', pageWidth / 2, footerY, { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleDateString('en-CA')}`, pageWidth - margin, footerY, { align: 'right' });

      // Save the PDF
      doc.save(`InstaCares-T2125-Tax-Statement-${taxYear}.pdf`);

    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPdf(false);
    }
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
              onClick={generateT2125PDF}
              disabled={generatingPdf}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 rounded-lg transition shadow-sm"
            >
              {generatingPdf ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                  Download T2125 PDF
                </>
              )}
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
        {totalGrossIncome === 0 && quarterlyData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No tax data available for this period</p>
              <p className="text-sm mt-2">Complete bookings to generate tax reports</p>
            </div>
          </div>
        ) : (
          <>
            {selectedView === 'overview' && (
              <div className="h-80">
                {quarterlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quarterlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                      <XAxis
                        dataKey="quarter"
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
                      <Bar dataKey="income" fill="#10B981" name="Income" />
                      <Bar dataKey="expenses" fill="#EF4444" name="Platform Fees" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    No quarterly data available
                  </div>
                )}
              </div>
            )}

            {selectedView === 'expenses' && (
              <div className="h-80">
                {expenseBreakdown.length > 0 && totalExpenses > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdown as any[]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ category, percentage }: any) =>
                          `${category}: ${percentage}%`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="amount"
                      >
                        {expenseBreakdown.map((entry, index) => (
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
                    <div className="text-center">
                      <p>No expense data available</p>
                      <p className="text-sm mt-2">Platform fees will appear here when you complete bookings</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedView === 'quarterly' && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Quarterly Tax Payments
                </h4>
                {quarterlyTaxes.length > 0 ? (
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
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <p>No quarterly tax data available</p>
                    <p className="text-sm mt-2">Complete bookings to see estimated quarterly taxes</p>
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

export default TaxReports;
