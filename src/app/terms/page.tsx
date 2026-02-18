"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../../contexts/LanguageContext';

export default function TermsOfService() {
  const { t, locale } = useLanguage();
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const sections = [
    {
      id: 'description',
      title: t('terms.descriptionTitle'),
      content: t('terms.descriptionContent')
    },
    {
      id: 'responsibilities',
      title: t('terms.responsibilitiesTitle'),
      content: t('terms.responsibilitiesContent')
    },
    {
      id: 'eligibility',
      title: t('terms.eligibilityTitle'),
      content: t('terms.eligibilityContent')
    },
    {
      id: 'conduct',
      title: t('terms.conductTitle'),
      content: t('terms.conductContent')
    },
    {
      id: 'fees',
      title: t('terms.feesTitle'),
      content: t('terms.feesContent')
    },
    {
      id: 'cancellation',
      title: t('terms.cancellationTitle'),
      content: t('terms.cancellationContent')
    },
    {
      id: 'liability',
      title: t('terms.liabilityTitle'),
      content: t('terms.liabilityContent')
    },
    {
      id: 'indemnification',
      title: t('terms.indemnificationTitle'),
      content: t('terms.indemnificationContent')
    },
    {
      id: 'termination',
      title: t('terms.terminationTitle'),
      content: t('terms.terminationContent')
    }
  ];

  const getLocalizedDate = () => {
    const localeMap: Record<string, string> = {
      'en': 'en-US',
      'fr': 'fr-CA',
      'es': 'es-ES'
    };
    const dateLocale = localeMap[locale] || 'en-US';
    return new Date().toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              {t('terms.backToHome')}
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t('terms.title')}</h1>
            <div className="w-24"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Important Notice */}
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-bold text-red-800 dark:text-red-200 mb-3">{t('terms.importantNotice')}</h2>
          <p className="text-red-700 dark:text-red-300 font-medium">
            {t('terms.importantNoticeText')}
          </p>
        </div>

        {/* Introduction */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{t('terms.termsOfUse')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('terms.intro1')}
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('terms.intro2')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 italic">
            {t('terms.lastUpdated')} {getLocalizedDate()}
          </p>
        </div>

        {/* Collapsible Sections */}
        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {section.title}
                </h3>
                {expandedSections[section.id] ? (
                  <ChevronUpIcon className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-gray-500" />
                )}
              </button>
              {expandedSections[section.id] && (
                <div className="px-6 pb-6">
                  <div className="prose prose-gray dark:prose-invert max-w-none">
                    <p className="text-gray-600 dark:text-gray-400 whitespace-pre-line">
                      {section.content}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Age Restrictions */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">{t('terms.ageRestrictionsTitle')}</h3>
          <p className="text-yellow-700 dark:text-yellow-300">
            {t('terms.ageRestrictionsContent')}
          </p>
        </div>

        {/* Jurisdiction */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">{t('terms.jurisdictionTitle')}</h3>
          <p className="text-blue-700 dark:text-blue-300">
            {t('terms.jurisdictionContent')}
          </p>
        </div>

        {/* Contact Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t('terms.contactTitle')}</h3>
          <div className="space-y-2 text-gray-600 dark:text-gray-400">
            <p className="font-medium">{t('terms.contactCompany')}</p>
            <p>{t('terms.contactAddress1')}</p>
            <p>{t('terms.contactAddress2')}</p>
            <div className="pt-3 space-y-1">
              <p>{t('terms.contactWeb')} <a href="https://www.instacares.com" className="text-rose-600 hover:underline">www.instacares.com</a></p>
              <p>{t('terms.contactEmail')} <a href="mailto:info@instacares.com" className="text-rose-600 hover:underline">info@instacares.com</a></p>
              <p>{t('terms.contactPhone')} <a href="tel:+18883940259" className="text-rose-600 hover:underline">(888) 394-0259</a></p>
            </div>
          </div>
        </div>

        {/* Agreement Button */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            {t('terms.agreementText')}
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-3 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 transition"
          >
            {t('terms.acceptButton')}
          </Link>
        </div>
      </div>
    </div>
  );
}
