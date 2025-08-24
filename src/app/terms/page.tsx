"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export default function TermsOfService() {
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
      title: 'Description of Services',
      content: `Instacares.com's mission is to foster the recognition and trustworthiness of high-quality care. Our objective is to enhance transparency between parents and caregivers, thereby mitigating the potential risks associated with seeking care. 

We offer an online platform that enables caregivers to post profiles and interact with parents about potential daycare requirements. However, we do not employ any caregivers, nor do we represent any caregivers or parents. We do not provide referral services.

We verify, review, evaluate, interview, and perform background checks on caregivers based on the information submitted to us. However, we provide no assurance or representation regarding the quality, timing, or legality of the services actually delivered by caregivers or the integrity, responsibility, or actions of caregivers and parents.`
    },
    {
      id: 'responsibilities',
      title: 'User Responsibilities',
      content: `You are solely responsible for:
• Interviewing, performing reference checks on, verifying information provided by, and selecting an appropriate caregiver or parent
• Complying with all applicable employment, non-discrimination, and other laws
• Verifying the age of the caregiver (must be 18 years or older)
• Verifying the caregiver's eligibility to work in Canada

We conduct limited screening of caregivers based on information provided to us. Do not rely on this limited screening as complete, accurate, up-to-date, or conclusive.`
    },
    {
      id: 'eligibility',
      title: 'Eligibility Requirements',
      content: `To use our services, you must:
• Be eighteen (18) years of age or older
• Have the capacity to form legally binding contracts
• Reside in a postal code region where Instacares.com offers services
• Be a citizen or legal resident of Canada or hold a valid Canadian visa
• If you're a caregiver, be legally entitled to work in Canada
• Have completed a vulnerable sector check within the last 5 years

You represent that you have never been involved in any criminal offence involving violence, abuse, neglect, theft, fraud, or any offence endangering the safety of others.`
    },
    {
      id: 'conduct',
      title: 'User Conduct Rules',
      content: `By using our services, you agree NOT to:
• Use the site for any unlawful purpose or illegal activities
• Post defamatory, inaccurate, abusive, obscene, or offensive content
• Harass, abuse, or harm another person or group
• Use another user's account without permission
• Provide false or inaccurate information
• Make automated use of the system or scrape data
• Use our communication systems for commercial solicitation

We reserve the right to review and delete any content that violates these terms.`
    },
    {
      id: 'fees',
      title: 'Fees and Payments',
      content: `Parents may be charged transaction fees when using our platform to make reservations. Service fees are generally non-refundable except as determined at Instacares.com's sole discretion.

We reserve the right to change service fees at any time with notice to registered users. Fee changes will not affect bookings made prior to the effective date.

Parents may elect, with caregiver consent, to make payments on-site without incurring transaction fees.`
    },
    {
      id: 'liability',
      title: 'Limitation of Liability',
      content: `IMPORTANT: There are risks, including the risk of physical harm, when dealing with people you connect with through our site. You assume all risks associated with interactions with other users.

Instacares.com is not responsible for the conduct of any user of the site or services. We expressly disclaim any liability for damage, suits, claims, and/or controversies that may arise from user interactions.

Our aggregate liability will not exceed the price paid for your account, or if you haven't paid, we have no liability. We are not liable for any indirect, consequential, or incidental damages.`
    },
    {
      id: 'indemnification',
      title: 'Indemnification',
      content: `You agree to indemnify, defend, and hold harmless Instacares.com and its employees from any claims, losses, expenses, or demands of liability arising from:
• Materials and content you submit through the Site
• Your use of the Site or Services in violation of these Terms
• Any claim by a third party arising from your actions`
    },
    {
      id: 'termination',
      title: 'Termination',
      content: `Instacares.com reserves the right to terminate your access to the site and services at any time, with or without notice, for any reason including:
• Violation of these terms
• Misuse of site content
• Being unsuitable for participation as a user
• Any other reason at our sole discretion`
    }
  ];

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
              Back to Home
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Terms of Service</h1>
            <div className="w-24"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Important Notice */}
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-bold text-red-800 dark:text-red-200 mb-3">IMPORTANT NOTICE</h2>
          <p className="text-red-700 dark:text-red-300 font-medium">
            YOU AGREE TO THESE TERMS OF USE WHEN YOU BROWSE INSTACARES.COM. YOU WILL WAIVE CERTAIN LEGAL RIGHTS, 
            INCLUDING THE RIGHT TO SUE OR CLAIM COMPENSATION IN CERTAIN CIRCUMSTANCES. READ THIS DOCUMENT CAREFULLY.
          </p>
        </div>

        {/* Introduction */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Terms of Use</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The terms and conditions that govern the use of the Instacares.com site and/or the Instacares.com Services 
            by Canadian residents are outlined below.
          </p>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Prior to using the site or its services, kindly review the following terms. Whether you are registering as 
            a parent seeking child care or a caregiver, by utilizing the site or its services, you hereby represent, 
            warrant, understand, agree to, and accept these terms in their entirety.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 italic">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
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
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Age Restrictions</h3>
          <p className="text-yellow-700 dark:text-yellow-300">
            Instacares.com is intended for people 18 and over. We will not knowingly collect any information from 
            individuals under 18. If we determine you are under 18, your registration will be terminated immediately.
          </p>
        </div>

        {/* Jurisdiction */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mt-6">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">Jurisdiction</h3>
          <p className="text-blue-700 dark:text-blue-300">
            Any dispute arising out of the Site and/or Services shall be governed by the laws of the Province of Ontario, 
            and you expressly agree to the exclusive jurisdiction of the courts of Ontario.
          </p>
        </div>

        {/* Contact Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h3>
          <div className="space-y-2 text-gray-600 dark:text-gray-400">
            <p className="font-medium">Team Instacares</p>
            <p>22 King Street South, Suite 300</p>
            <p>Waterloo, Ontario, N2J 1N8</p>
            <div className="pt-3 space-y-1">
              <p>Web: <a href="https://www.instacares.com" className="text-rose-600 hover:underline">www.instacares.com</a></p>
              <p>Email: <a href="mailto:info@instacares.com" className="text-rose-600 hover:underline">info@instacares.com</a></p>
              <p>Phone: <a href="tel:+18883940259" className="text-rose-600 hover:underline">(888) 394-0259</a></p>
            </div>
          </div>
        </div>

        {/* Agreement Button */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            By using Instacares.com, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
          <Link
            href="/"
            className="inline-block px-8 py-3 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 transition"
          >
            I Understand and Accept
          </Link>
        </div>
      </div>
    </div>
  );
}