"use client";

import React, { useState } from 'react';
import {
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';

interface NotificationTest {
  type: 'email' | 'sms';
  template: string;
  recipient: string;
}

interface TestResult {
  success: boolean;
  message: string;
  timestamp: Date;
}

const AdminNotificationManager: React.FC = () => {
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('booking_confirmed');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const emailTemplates = [
    { value: 'booking_confirmed', label: 'Booking Confirmation' },
    { value: 'booking_cancelled', label: 'Booking Cancellation' },
    { value: 'new_booking_caregiver', label: 'New Booking (Caregiver)' },
    { value: 'payment_received', label: 'Payment Received' },
    { value: 'review_request', label: 'Review Request' },
    { value: 'account_approved', label: 'Account Approved' }
  ];

  const smsTemplates = [
    { value: 'booking_confirmed', label: 'Booking Confirmation SMS' },
    { value: 'urgent_booking', label: 'Urgent Booking Alert' },
    { value: 'booking_reminder', label: 'Booking Reminder' },
    { value: 'verification_code', label: 'Verification Code' },
    { value: 'booking_cancelled', label: 'Cancellation SMS' }
  ];

  const sendTestEmail = async () => {
    if (!testEmail) {
      addResult(false, 'Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/test-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          template: selectedTemplate,
          testEmail: testEmail,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        addResult(true, `Email sent successfully to ${testEmail}`);
      } else {
        addResult(false, data.error || 'Failed to send email');
      }
    } catch (error) {
      addResult(false, 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const sendTestSMS = async () => {
    if (!testPhone) {
      addResult(false, 'Please enter a phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/test-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'sms',
          template: selectedTemplate,
          testPhone: testPhone,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        addResult(true, `SMS sent successfully to ${testPhone}`);
      } else {
        addResult(false, data.error || 'Failed to send SMS');
      }
    } catch (error) {
      addResult(false, 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const addResult = (success: boolean, message: string) => {
    const newResult: TestResult = {
      success,
      message,
      timestamp: new Date()
    };
    setResults(prev => [newResult, ...prev.slice(0, 9)]); // Keep last 10 results
  };

  return (
    <div className="space-y-6">
      {/* Email Testing */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <EnvelopeIcon className="w-4 h-4 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Email Testing</h3>
              <p className="text-sm text-gray-600">Test email templates and delivery</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {emailTemplates.map(template => (
                  <option key={template.value} value={template.value}>
                    {template.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={sendTestEmail}
              disabled={loading || !testEmail}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              ) : (
                <PaperAirplaneIcon className="w-4 h-4 mr-2" />
              )}
              Send Test Email
            </button>
          </div>
        </div>
      </div>

      {/* SMS Testing */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="w-4 h-4 text-white" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">SMS Testing</h3>
              <p className="text-sm text-gray-600">Test SMS templates and delivery</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex">
              <InformationCircleIcon className="w-5 h-5 text-amber-400 mt-0.5 mr-2" />
              <p className="text-sm text-amber-700">
                SMS testing requires Twilio configuration. Add your Twilio credentials to .env.local to enable SMS sending.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+1234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMS Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {smsTemplates.map(template => (
                  <option key={template.value} value={template.value}>
                    {template.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={sendTestSMS}
              disabled={loading || !testPhone}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              ) : (
                <ChatBubbleLeftRightIcon className="w-4 h-4 mr-2" />
              )}
              Send Test SMS
            </button>
          </div>
        </div>
      </div>

      {/* Test Results */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                  <BellIcon className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
                <p className="text-sm text-gray-600">Recent notification test results</p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`flex items-start space-x-3 p-3 rounded-lg ${
                    result.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {result.success ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    ) : (
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        result.success ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {result.message}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {result.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Configuration Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Service Configuration</h3>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <EnvelopeIcon className="w-5 h-5 text-blue-500" />
                <span className="font-medium text-gray-900">Resend Email</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-green-600 font-medium">Configured</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <ChatBubbleLeftRightIcon className="w-5 h-5 text-green-500" />
                <span className="font-medium text-gray-900">Twilio SMS</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm text-yellow-600 font-medium">Needs Setup</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminNotificationManager;