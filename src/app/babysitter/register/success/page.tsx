'use client';

import Link from 'next/link';
import Header from '@/components/Header';
import { CheckCircle, Clock, Mail, ArrowRight } from 'lucide-react';

export default function BabysitterRegisterSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Application Submitted!
          </h1>

          <p className="text-gray-600 text-lg mb-8">
            Thank you for applying to become a babysitter on InstaCares.
            We&apos;re excited to have you join our community!
          </p>

          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="font-semibold text-gray-900 mb-4">What happens next?</h2>

            <div className="space-y-4 text-left">
              <div className="flex items-start">
                <div className="w-8 h-8 bg-[#8B5CF6] text-white rounded-full flex items-center justify-center flex-shrink-0 mr-3">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">Document Verification</p>
                  <p className="text-gray-600 text-sm">We&apos;ll review your ID and police check documents</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-8 h-8 bg-[#8B5CF6] text-white rounded-full flex items-center justify-center flex-shrink-0 mr-3">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">Identity Match</p>
                  <p className="text-gray-600 text-sm">We&apos;ll verify your selfie matches your ID photo</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-8 h-8 bg-[#8B5CF6] text-white rounded-full flex items-center justify-center flex-shrink-0 mr-3">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900">Approval Email</p>
                  <p className="text-gray-600 text-sm">You&apos;ll receive an email once your profile is approved</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center text-amber-600 bg-amber-50 rounded-lg p-4 mb-8">
            <Clock className="w-5 h-5 mr-2" />
            <span>Review typically takes 24-48 hours</span>
          </div>

          <div className="flex items-center justify-center text-blue-600 bg-blue-50 rounded-lg p-4 mb-8">
            <Mail className="w-5 h-5 mr-2" />
            <span>Check your email for updates on your application</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Return to Home
            </Link>
            <Link
              href="/babysitter-dashboard"
              className="flex items-center justify-center px-6 py-3 bg-[#8B5CF6] text-white rounded-lg font-medium hover:bg-[#7C3AED] transition-colors"
            >
              Go to Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
