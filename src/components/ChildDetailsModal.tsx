'use client';

import { Fragment, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Dialog, Transition } from '@headlessui/react';
import {
  XMarkIcon,
  UserCircleIcon,
  CalendarDaysIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  InformationCircleIcon,
  SparklesIcon,
  PrinterIcon,
  EnvelopeIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { addCSRFHeader } from '@/lib/csrf';

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age: number;
  gender?: string;
  allergies?: string[];
  medications?: string[];
  medicalConditions?: string[];
  emergencyMedicalInfo?: string;
  bloodType?: string;
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  dietaryRestrictions?: string[];
  specialInstructions?: string;
  pickupInstructions?: string;
  photoUrl?: string;
}

interface ChildDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  parentName: string;
}

// Safely coerce a value that may be a JSON string, array, or other type into an array
function ensureArray<T = string>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    if (!val.trim()) return [];
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [val as T];
    }
  }
  return [];
}

// Normalize child data fields that may be stored as JSON strings in the DB
function normalizeChild(child: Child): Child {
  return {
    ...child,
    allergies: ensureArray(child.allergies),
    medications: ensureArray(child.medications),
    medicalConditions: ensureArray(child.medicalConditions),
    dietaryRestrictions: ensureArray(child.dietaryRestrictions),
    emergencyContacts: ensureArray(child.emergencyContacts),
  };
}

export default function ChildDetailsModal({
  isOpen,
  onClose,
  bookingId,
  parentName,
}: ChildDetailsModalProps) {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && bookingId) {
      fetchChildren();
      setEmailSent(false);
    }
  }, [isOpen, bookingId]);

  const fetchChildren = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/children`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch children');
      }

      setChildren((data.data || []).map(normalizeChild));
      setSelectedChildIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load children');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const generatePrintContent = (childrenToPrint: Child[]) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Children Information - ${parentName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #3b82f6; }
            .header h1 { color: #3b82f6; font-size: 24px; margin-bottom: 5px; }
            .header p { color: #666; font-size: 14px; }
            .child-card { page-break-inside: avoid; margin-bottom: 30px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
            .child-header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 15px 20px; }
            .child-header h2 { font-size: 20px; margin-bottom: 5px; }
            .child-header p { opacity: 0.9; font-size: 14px; }
            .child-body { padding: 20px; }
            .section { margin-bottom: 20px; }
            .section-title { font-weight: 600; font-size: 14px; color: #374151; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 1px solid #e5e7eb; }
            .section-title.medical { color: #dc2626; border-color: #fecaca; }
            .section-title.care { color: #059669; border-color: #a7f3d0; }
            .section-title.emergency { color: #2563eb; border-color: #bfdbfe; }
            .info-row { display: flex; margin-bottom: 8px; }
            .info-label { font-weight: 500; color: #6b7280; width: 140px; flex-shrink: 0; }
            .info-value { color: #111827; }
            .tags { display: flex; flex-wrap: wrap; gap: 5px; }
            .tag { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; }
            .tag.allergy { background: #fee2e2; color: #991b1b; }
            .tag.medication { background: #ffedd5; color: #9a3412; }
            .tag.condition { background: #fef3c7; color: #92400e; }
            .tag.dietary { background: #d1fae5; color: #065f46; }
            .emergency-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px; margin-top: 10px; }
            .emergency-box p { color: #991b1b; font-size: 13px; }
            .contact-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .contact-card { background: #f3f4f6; padding: 12px; border-radius: 8px; }
            .contact-card .name { font-weight: 600; color: #111827; }
            .contact-card .relationship { font-size: 12px; color: #6b7280; }
            .contact-card .phone { color: #2563eb; font-size: 14px; margin-top: 5px; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }
            @media print {
              body { padding: 0; }
              .child-card { border: 1px solid #ccc; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Children Information</h1>
            <p>${parentName}'s Children • Generated ${new Date().toLocaleDateString()}</p>
          </div>
          ${childrenToPrint.map(child => `
            <div class="child-card">
              <div class="child-header">
                <h2>${child.firstName} ${child.lastName}</h2>
                <p>${child.age} years old${child.gender ? ` • ${child.gender}` : ''} • Born ${formatDate(child.dateOfBirth)}</p>
              </div>
              <div class="child-body">
                <div class="section">
                  <div class="section-title medical">Medical Information</div>
                  ${child.bloodType ? `
                    <div class="info-row">
                      <span class="info-label">Blood Type:</span>
                      <span class="info-value">${child.bloodType}</span>
                    </div>
                  ` : ''}
                  ${child.allergies && child.allergies.length > 0 ? `
                    <div class="info-row">
                      <span class="info-label">Allergies:</span>
                      <div class="tags">
                        ${child.allergies.map(a => `<span class="tag allergy">${a}</span>`).join('')}
                      </div>
                    </div>
                  ` : ''}
                  ${child.medications && child.medications.length > 0 ? `
                    <div class="info-row">
                      <span class="info-label">Medications:</span>
                      <div class="tags">
                        ${child.medications.map(m => `<span class="tag medication">${m}</span>`).join('')}
                      </div>
                    </div>
                  ` : ''}
                  ${child.medicalConditions && child.medicalConditions.length > 0 ? `
                    <div class="info-row">
                      <span class="info-label">Conditions:</span>
                      <div class="tags">
                        ${child.medicalConditions.map(c => `<span class="tag condition">${c}</span>`).join('')}
                      </div>
                    </div>
                  ` : ''}
                  ${child.emergencyMedicalInfo ? `
                    <div class="emergency-box">
                      <strong>Emergency Medical Info:</strong>
                      <p>${child.emergencyMedicalInfo}</p>
                    </div>
                  ` : ''}
                  ${!child.bloodType && (!child.allergies || child.allergies.length === 0) && (!child.medications || child.medications.length === 0) && (!child.medicalConditions || child.medicalConditions.length === 0) && !child.emergencyMedicalInfo ? '<p style="color: #9ca3af; font-style: italic;">No medical information provided</p>' : ''}
                </div>

                <div class="section">
                  <div class="section-title care">Care Instructions</div>
                  ${child.dietaryRestrictions && child.dietaryRestrictions.length > 0 ? `
                    <div class="info-row">
                      <span class="info-label">Dietary:</span>
                      <div class="tags">
                        ${child.dietaryRestrictions.map(d => `<span class="tag dietary">${d}</span>`).join('')}
                      </div>
                    </div>
                  ` : ''}
                  ${child.specialInstructions ? `
                    <div class="info-row">
                      <span class="info-label">Special Instructions:</span>
                      <span class="info-value">${child.specialInstructions}</span>
                    </div>
                  ` : ''}
                  ${child.pickupInstructions ? `
                    <div class="info-row">
                      <span class="info-label">Pickup Instructions:</span>
                      <span class="info-value">${child.pickupInstructions}</span>
                    </div>
                  ` : ''}
                  ${(!child.dietaryRestrictions || child.dietaryRestrictions.length === 0) && !child.specialInstructions && !child.pickupInstructions ? '<p style="color: #9ca3af; font-style: italic;">No special care instructions provided</p>' : ''}
                </div>

                ${child.emergencyContacts && child.emergencyContacts.length > 0 ? `
                  <div class="section">
                    <div class="section-title emergency">Emergency Contacts</div>
                    <div class="contact-grid">
                      ${child.emergencyContacts.map(contact => `
                        <div class="contact-card">
                          <div class="name">${contact.name}</div>
                          <div class="relationship">${contact.relationship}</div>
                          <div class="phone">${contact.phone}</div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          `).join('')}
          <div class="footer">
            <p>InstaCares - Trusted Childcare Platform</p>
            <p>This information is confidential and for caregiver use only.</p>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const printContent = generatePrintContent(children);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  const handleEmail = async () => {
    setEmailSending(true);
    try {
      const response = await fetch('/api/bookings/email-children', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          bookingId,
          parentName,
          children,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send email');
      }

      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  const selectedChild = children[selectedChildIndex];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
                  <div className="absolute right-4 top-4 flex items-center space-x-2">
                    {children.length > 0 && !loading && (
                      <>
                        <button
                          onClick={handlePrint}
                          className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition"
                          title="Print all children info"
                        >
                          <PrinterIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={handleEmail}
                          disabled={emailSending}
                          className={`p-2 rounded-lg transition ${
                            emailSent
                              ? 'text-green-300 bg-green-500/20'
                              : 'text-white/80 hover:text-white hover:bg-white/20'
                          }`}
                          title="Email children info to yourself"
                        >
                          {emailSending ? (
                            <div className="h-5 w-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                          ) : emailSent ? (
                            <CheckIcon className="h-5 w-5" />
                          ) : (
                            <EnvelopeIcon className="h-5 w-5" />
                          )}
                        </button>
                      </>
                    )}
                    <button
                      onClick={onClose}
                      className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <Dialog.Title className="text-xl font-bold text-white">
                    Children Information
                  </Dialog.Title>
                  <p className="text-white/80 text-sm mt-1">
                    {parentName}'s children
                  </p>
                </div>

                {/* Content */}
                <div className="p-6" ref={printRef}>
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
                      <span className="ml-3 text-gray-600 dark:text-gray-300">Loading children...</span>
                    </div>
                  ) : error ? (
                    <div className="text-center py-12">
                      <ExclamationTriangleIcon className="h-12 w-12 mx-auto text-red-500 mb-4" />
                      <p className="text-red-600 dark:text-red-400">{error}</p>
                      <button
                        onClick={fetchChildren}
                        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : children.length === 0 ? (
                    <div className="text-center py-12">
                      <UserCircleIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600 dark:text-gray-300">No children profiles found</p>
                    </div>
                  ) : (
                    <>
                      {/* Child selector tabs (if multiple children) */}
                      {children.length > 1 && (
                        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
                          {children.map((child, index) => (
                            <button
                              key={child.id}
                              onClick={() => setSelectedChildIndex(index)}
                              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                                selectedChildIndex === index
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              {child.firstName}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Selected child details */}
                      {selectedChild && (
                        <div className="space-y-6">
                          {/* Basic Info */}
                          <div className="flex items-start space-x-4">
                            {selectedChild.photoUrl ? (
                              <Image
                                src={selectedChild.photoUrl}
                                width={80}
                                height={80}
                                alt={selectedChild.firstName}
                                className="w-20 h-20 rounded-full object-cover border-4 border-blue-100 dark:border-blue-900"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold">
                                {selectedChild.firstName[0]}{selectedChild.lastName[0]}
                              </div>
                            )}
                            <div>
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {selectedChild.firstName} {selectedChild.lastName}
                              </h3>
                              <div className="flex items-center text-gray-600 dark:text-gray-300 mt-1">
                                <CalendarDaysIcon className="h-4 w-4 mr-1" />
                                <span className="text-sm">
                                  {selectedChild.age} years old
                                  {selectedChild.gender && ` • ${selectedChild.gender}`}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Born {formatDate(selectedChild.dateOfBirth)}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Medical Info */}
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                              <h4 className="font-semibold text-red-800 dark:text-red-300 flex items-center mb-3">
                                <HeartIcon className="h-5 w-5 mr-2" />
                                Medical Information
                              </h4>

                              {selectedChild.bloodType && (
                                <div className="mb-2">
                                  <span className="text-xs font-medium text-red-600 dark:text-red-400">Blood Type:</span>
                                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{selectedChild.bloodType}</span>
                                </div>
                              )}

                              {selectedChild.allergies && selectedChild.allergies.length > 0 && (
                                <div className="mb-2">
                                  <span className="text-xs font-medium text-red-600 dark:text-red-400">Allergies:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {selectedChild.allergies.map((allergy, i) => (
                                      <span key={i} className="px-2 py-0.5 bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-200 rounded-full text-xs">
                                        {allergy}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {selectedChild.medications && selectedChild.medications.length > 0 && (
                                <div className="mb-2">
                                  <span className="text-xs font-medium text-red-600 dark:text-red-400">Medications:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {selectedChild.medications.map((med, i) => (
                                      <span key={i} className="px-2 py-0.5 bg-orange-100 dark:bg-orange-800/50 text-orange-700 dark:text-orange-200 rounded-full text-xs">
                                        {med}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {selectedChild.medicalConditions && selectedChild.medicalConditions.length > 0 && (
                                <div className="mb-2">
                                  <span className="text-xs font-medium text-red-600 dark:text-red-400">Conditions:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {selectedChild.medicalConditions.map((cond, i) => (
                                      <span key={i} className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-800/50 text-yellow-700 dark:text-yellow-200 rounded-full text-xs">
                                        {cond}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {selectedChild.emergencyMedicalInfo && (
                                <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
                                  <span className="text-xs font-medium text-red-700 dark:text-red-300 block mb-1">Emergency Info:</span>
                                  <p className="text-sm text-red-800 dark:text-red-200">{selectedChild.emergencyMedicalInfo}</p>
                                </div>
                              )}

                              {!selectedChild.bloodType &&
                               (!selectedChild.allergies || selectedChild.allergies.length === 0) &&
                               (!selectedChild.medications || selectedChild.medications.length === 0) &&
                               (!selectedChild.medicalConditions || selectedChild.medicalConditions.length === 0) &&
                               !selectedChild.emergencyMedicalInfo && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No medical information provided</p>
                              )}
                            </div>

                            {/* Dietary & Care Info */}
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
                              <h4 className="font-semibold text-green-800 dark:text-green-300 flex items-center mb-3">
                                <SparklesIcon className="h-5 w-5 mr-2" />
                                Care Instructions
                              </h4>

                              {selectedChild.dietaryRestrictions && selectedChild.dietaryRestrictions.length > 0 && (
                                <div className="mb-2">
                                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Dietary Restrictions:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {selectedChild.dietaryRestrictions.map((diet, i) => (
                                      <span key={i} className="px-2 py-0.5 bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-200 rounded-full text-xs">
                                        {diet}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {selectedChild.specialInstructions && (
                                <div className="mb-2">
                                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Special Instructions:</span>
                                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{selectedChild.specialInstructions}</p>
                                </div>
                              )}

                              {selectedChild.pickupInstructions && (
                                <div className="mb-2">
                                  <span className="text-xs font-medium text-green-600 dark:text-green-400">Pickup Instructions:</span>
                                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{selectedChild.pickupInstructions}</p>
                                </div>
                              )}

                              {(!selectedChild.dietaryRestrictions || selectedChild.dietaryRestrictions.length === 0) &&
                               !selectedChild.specialInstructions &&
                               !selectedChild.pickupInstructions && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No special care instructions provided</p>
                              )}
                            </div>
                          </div>

                          {/* Emergency Contacts */}
                          {selectedChild.emergencyContacts && selectedChild.emergencyContacts.length > 0 && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                              <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center mb-3">
                                <PhoneIcon className="h-5 w-5 mr-2" />
                                Emergency Contacts
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {selectedChild.emergencyContacts.map((contact, i) => (
                                  <div key={i} className="flex items-center space-x-3 bg-white dark:bg-gray-700 rounded-lg p-3 shadow-sm">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                                      <UserCircleIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900 dark:text-white text-sm">{contact.name}</p>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{contact.relationship}</p>
                                      <a href={`tel:${contact.phone}`} className="text-blue-600 dark:text-blue-400 text-sm hover:underline">
                                        {contact.phone}
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                      <InformationCircleIcon className="h-4 w-4 mr-1" />
                      {children.length} child{children.length !== 1 ? 'ren' : ''} on file
                    </p>
                    <div className="flex items-center space-x-2">
                      {children.length > 0 && !loading && (
                        <>
                          <button
                            onClick={handlePrint}
                            className="px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition flex items-center text-sm"
                          >
                            <PrinterIcon className="h-4 w-4 mr-1.5" />
                            Print
                          </button>
                          <button
                            onClick={handleEmail}
                            disabled={emailSending}
                            className={`px-3 py-2 rounded-lg transition flex items-center text-sm ${
                              emailSent
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                          >
                            {emailSending ? (
                              <>
                                <div className="h-4 w-4 mr-1.5 border-2 border-gray-400 border-t-gray-600 rounded-full animate-spin" />
                                Sending...
                              </>
                            ) : emailSent ? (
                              <>
                                <CheckIcon className="h-4 w-4 mr-1.5" />
                                Sent!
                              </>
                            ) : (
                              <>
                                <EnvelopeIcon className="h-4 w-4 mr-1.5" />
                                Email
                              </>
                            )}
                          </button>
                        </>
                      )}
                      <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
