"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../../contexts/LanguageContext';

export default function PrivacyPolicy() {
  const { t } = useLanguage();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const sectionKeys = [
    'overview',
    'personalInfo',
    'collection',
    'caregiverInfo',
    'parentInfo',
    'cookies',
    'sharing',
    'retention',
    'consent',
    'security',
    'emailRisks',
    'optOut',
    'otherInfo',
    'contact'
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            {t('privacy.title')}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            {t('privacy.updated')}
          </p>
          <div className="flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-rose-600 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30 transition-colors"
            >
              {t('privacy.backToHome')}
            </Link>
          </div>
        </div>

        {/* Privacy Policy Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="p-8">
            <div className="space-y-6">
              {sectionKeys.map((sectionKey) => (
                <div key={sectionKey} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 pb-6 last:pb-0">
                  <button
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {t(`privacy.sections.${sectionKey}.title`)}
                    </h2>
                    {expandedSections[sectionKey] ? (
                      <ChevronDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    ) : (
                      <ChevronRightIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    )}
                  </button>

                  {expandedSections[sectionKey] && (
                    <div className="mt-4 prose prose-gray dark:prose-invert max-w-none">
                      {t(`privacy.sections.${sectionKey}.content`).split('\n\n').map((paragraph: string, index: number) => (
                        <p key={index} className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 last:mb-0">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {t('privacy.questionsTitle')}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('privacy.questionsText')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:info@instacares.com"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800 transition-colors"
              >
                {t('privacy.emailUs')}
              </a>
              <a
                href="tel:+18883940259"
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                {t('privacy.callUs')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
