"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

export default function PrivacyPolicy() {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const sections = [
    {
      id: 'overview',
      title: 'Overview',
      content: `Instacare 24/7 Inc. respects the privacy and security of your personal information.

This Privacy Policy describes how Instacare 24/7 Inc. and its affiliates (herein, collectively, "INSTACARES," "we", "us" and "our") collect, use, share, retain, and protect personal information obtained through your customer relationship with us.

Any capitalized term not otherwise defined in this Privacy Policy will be understood to have the meaning given to such term in our Terms of Service.

By using any of our Services, using or accessing our Platform, website, or social media pages (collectively, the "Sites"), or contacting us for customer support (i.e., by email, telephone, filling out forms or otherwise), you agree to the terms of this Privacy Policy and consent to the policies and practices described herein for the collection, use and disclosure of your Personal Information.`
    },
    {
      id: 'personal-info',
      title: 'What is Personal Information?',
      content: `Personal information is any information that identifies you, or by which your identity could be deduced. This may include information such as your name, address, phone number, email address, payment details (for example, your credit card information), transaction history and any other information you provide us (collectively, "Personal Information").`
    },
    {
      id: 'collection',
      title: 'What Personal Information Do We Collect and Why Do We Collect It?',
      content: `We collect and store any information that you provide to us directly when you create an Account, use our Services, access our Platform, visit our Sites, or contact customer support. Most of the information collected about you for retail services is basic information that we need to perform our Services, complete a purchase with respect to our paid Services, or process and keep track of transactions.

Any information you submit through or publish on the Sites may be accessed and utilized by visitors to the Sites, Caregivers, Parents, and other users. If you provide us with any Personal Information of another person, you represent and warrant to us that you have the right and authority to provide us with that Personal Information.

When you access our Platform, visit our Sites, or use our Services, we may also collect certain kinds of user information, such as IP addresses, browser and device types, log files, and which pages or content you access. This information may be associated with you and used to deliver our Services and provide technical troubleshooting. Certain parts of our Platform and Sites use cookies to enable our systems to recognize your browser and to provide convenience and other features to you, such as recognizing you as an existing customer or previous visitor.

We use your Personal Information to: (a) register your Account, verify your Account information, and provide our Services to you; (b) communicate with you from time to time via telephone, email and/or the Platform; (c) improve and optimize our Platform, Sites and Services (for example, by generating analytics about how visitors browse and interact with the Platform and Sites, and to assess the success of our marketing and advertising campaigns); and (d) other business purposes.

When you make a payment to us, we use third-party services to process payments and do not have access to your payment information. The third-party services will be responsible for securely managing your personal and financial data in accordance with payment card industry data security standards.`
    },
    {
      id: 'caregiver-info',
      title: 'Caregiver Information',
      content: `Caregivers should be aware that we collect and store all the information that you provide to us in creating your Account and setting up a profile on the Platform which information may include details regarding the care you offer, your availability, your location, your experience, the languages you speak, the related services you may provide, photographs and images, your phone number(s), references, and any other information you choose to include in your Account.

While Caregivers are required to submit a criminal record check with vulnerable sector check in connection with registering an Account, the results of this record check will not be published on the Sites, other than a notation published on a Caregiver's public profile confirming a vulnerable sector check has been provided and verified.`
    },
    {
      id: 'parent-info',
      title: 'Parent Information',
      content: `Parents should be aware that we collect, store and share Personal Information on the Sites through the Platform and other online features and offerings, such as our online communications platform, that certain registered users may use to communicate and share information with one another.

We may also collect Personal Information about you from third parties. Without limitation and by way of example only, this occurs when Caregivers are rated or reviewed, when we obtain information from references for a Caregiver, when Parents, Caregivers and others communicate directly with each other through the Sites, and when we receive information about Parents, Caregivers and others by phone, email, or in person.

Our Sites and Services are intended for individuals aged 18 years and older. Accordingly, we do not knowingly collect any Personal Information from individuals under the age of 18 years.`
    },
    {
      id: 'cookies',
      title: 'Cookies and Other Technologies',
      content: `We may use cookies and tracking pixels (also referred to as web beacons) to track site usage and trends, customize your experience on the Sites, and improve the quality of our Services.

A cookie is a data file that resides on your computer, mobile phone, or other device and allows us to recognize you as a registered Parent or Caregiver when you return to the Sites using the same device and web browser. You can remove or block cookies, or change your cookie settings, at any time, but in some cases, doing so may impact your ability to use our Sites and Services. Tracking pixels do not identify individual users, and the analysis of the data obtained by tracking pixels is performed on an aggregate basis.`
    },
    {
      id: 'sharing',
      title: 'Sharing Information',
      content: `Our Services involve the facilitation of introductions and interactions between Parents and Caregivers. In order to perform our Services, we will share certain Personal Information submitted by you with other Parents and Caregivers in order to enable you and such other registered users to search for, find, interact with, connect with, and share information with such registered users as you may have an interest in interacting with, or who may have an interest in interacting with you.

We will also share the information that Parents and Caregivers include in their Accounts (excluding your contact information) with site visitors and registered users generally. With limited exceptions, you will be able decide how much public-facing information you want to share with other users and visitors to the Sites. Your approximate residential location (through Google map plotting) will be made available on the Platform.

We are committed to protecting your privacy and, except in connection with the performance of our Services or as otherwise permitted pursuant to this Privacy Policy, we will not otherwise disclose your Personal Information to third parties to enable them to market their products and services. We will not sell your Personal Information under any circumstances. INSTACARES may use third-party services to deliver the Services to you, including but not limited to email, electronic document signing software applications, and other web tools. You acknowledge and agree that you may be required to agree to third-party terms of service in order to receive such third-party services and use the Services.

By consenting to this Privacy Policy, your information will be accessed and used in the following ways: (a) by employees and independent contractors engaged by INSTACARES (collectively, our "Representatives") to deliver our Services and respond to inquiries related to our Services; (b) by our Representatives to confirm your registration on our Platform, purchase of our Services (as applicable), understand our customer demographics and preferences, and communicate with you; (c) by third party service providers to provide certain services, such as processing payment card information, videoconferencing, web hosting, and email service providers; (d) by Parents and/or Caregivers in connection with your use of the Platform and our Services, as more particularly described in our Terms of Service; and (e) by companies that we share information with, such as advertisers, which may use the information we provide to them, often in combination with their existing information, to provide you with more relevant advertising, and to help us and third parties do the same.

We may also share your Personal Information as permitted or required by applicable laws and regulations, to respond to a subpoena, search warrant or other lawful request for information we receive, or to otherwise protect our rights and property.

We may also disclose your Personal Information without your consent in emergencies if it is clearly in your interest for us to do so and your consent cannot be obtained in a timely way, or if required or permitted by the Personal Information Protection and Electronic Documents Act (Canada) or substantially similar applicable provincial legislation.

We may also disclose your Personal Information to a public body or a law enforcement agency in Canada concerning an offense under the laws of Canada or a province (including to protect our rights and property or to protect the health, safety, and property of our community) or to respond to inquiries from or assist in an investigation by any such public body or law enforcement agency.`
    },
    {
      id: 'retention',
      title: 'How Long Do We Keep Your Information?',
      content: `We retain your Personal Information as long as required to provide our Services, or as long as required for INSTACARES to fulfill our business requirements, agreements, contracts, and legal obligations, whichever is later. When you create an Account, we will maintain your Personal Information for our records unless and until you ask us to delete this information. If you wish to update, review, or validate your Personal Information, please contact us at: info@instacares.com`
    },
    {
      id: 'consent',
      title: 'How Do We Get Your Consent?',
      content: `INSTACARES does not collect, use or disclose your Personal Information without your consent except where required by law. Consent may be provided in writing or orally or may be implied through your conduct with us.

BY PROVIDING US WITH YOUR PERSONAL INFORMATION OR USING OUR PLATFORM, SITES AND/OR SERVICES, YOU CONSENT TO OUR COLLECTION, USE AND DISCLOSURE OF YOUR PERSONAL INFORMATION IN ACCORDANCE WITH THIS PRIVACY POLICY AND AS OTHERWISE PERMITTED OR REQUIRED BY LAW.`
    },
    {
      id: 'security',
      title: 'How Do We Keep Your Information Safe?',
      content: `INSTACARES takes commercially reasonable precautions to protect your Personal Information in accordance with this Privacy Policy and applicable laws by implementing industry standard safeguards and following our internal data security practices and procedures, which include administrative, technical, and physical security measures. When we are required by law to provide information to third parties, we take reasonable steps to verify the lawful authority for the collection and we disclose only the information that is legally required. Our security practices rely on you keeping your username and password secure and not sharing that information with anyone else. You are also responsible for keeping your devices secure, to prevent unauthorized use and access of any passwords and account information. All Personal Information that we collect will be stored on our server, which is located in the State of Virginia, USA.`
    },
    {
      id: 'email-risks',
      title: 'What Are The Risks Of Email Communications?',
      content: `Although we primarily communicate with our Users and Suppliers via the Platform, we may communicate with you from time to time via email and/or SMS text message including, without limitation, to send you notifications regarding reservations for Caregiver services and notify you of other updates to our Services, Terms of Service and/or Privacy Policy. You should be aware that email and SMS correspondence cannot be guaranteed to be secure, unchanged, error free or safe. Email and SMS transmissions can be intercepted, diverted, altered, lost, or delayed.

Unless you notify us in writing not to use email and/or SMS to communicate with you, your acceptance of this Privacy Policy is deemed to include your consent for INSTACARES to use email and/or SMS to communicate with you, and your agreement to assume all risks in connection with same.

Note that our Services may only be available to you for so long as you continue to consent to INSTACARES communicating with you via email and SMS.`
    },
    {
      id: 'opt-out',
      title: 'How Can You Opt-Out Of Receiving Marketing Communications?',
      content: `If you decide you no longer want your Personal Information used or shared for marketing our Services to you, you may opt out of receiving promotional offers at any time by submitting a written request to us. We will process your request within a reasonable period of time following receipt of your request. Please note that even if you have opted out of receiving marketing communications, we may still contact you for non-marketing purposes including, without limitation, fraud, collections, account maintenance and transactional and/or operational purposes.`
    },
    {
      id: 'other-info',
      title: 'Use of Other Information',
      content: `We may use information that is not Personal Information to help us improve our Sites and our Services and to customize the user experience, such as by providing targeted, useful advertising based on the type of childcare services you seek. We may also aggregate information collected via cookies and similar technologies to use in statistical analysis to help us track trends and analyze patterns in the use of our Sites and Services.

We may share such information collected from you with our affiliates, third-party service providers, and others for any other commercial purpose, provided such information is not Personal Information and such information has been de-identified prior to being shared.

We may change our Privacy Policy from time to time. It is your responsibility to review our Privacy Policy for any changes. You understand and agree that your continued use of the Platform, Sites or our Services constitutes your agreement to any such changes.

Note that our Platform and Sites may contain links to other websites or social media pages which are not governed by this Privacy Policy. If you follow a link to any such other website or social media page, you agree you are doing so at your own risk.`
    },
    {
      id: 'contact',
      title: 'Contact Us',
      content: `If you have further questions or concerns regarding our privacy policies or procedures, or if you would like to review, verify, or update your Personal Information, please contact us.

You may contact us at:

Team Instacares
22 King Street South, Suite 300
Waterloo, Ontario,
N2J 1N8

web: www.instacares.com
Email: info@instacares.com
Phone: (888) 394-0259`
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Privacy Policy
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            Updated: April 2024
          </p>
          <div className="flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-rose-600 bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:hover:bg-rose-900/30 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>

        {/* Privacy Policy Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="p-8">
            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0 pb-6 last:pb-0">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {section.title}
                    </h2>
                    {expandedSections[section.id] ? (
                      <ChevronDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    ) : (
                      <ChevronRightIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    )}
                  </button>
                  
                  {expandedSections[section.id] && (
                    <div className="mt-4 prose prose-gray dark:prose-invert max-w-none">
                      {section.content.split('\n\n').map((paragraph, index) => (
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
              Questions About Our Privacy Policy?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              If you have any questions about this Privacy Policy or how we handle your personal information, please contact us.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:info@instacares.com"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-800 transition-colors"
              >
                Email Us
              </a>
              <a
                href="tel:+18883940259"
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Call Us: (888) 394-0259
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}