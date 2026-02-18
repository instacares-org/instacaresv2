'use client';

import { useRef } from 'react';
import {
  ShieldCheckIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  PhoneIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface BabysitterProfile {
  governmentIdFront?: string;
  policeCheck?: string;
  cprCertificate?: string;
  phoneVerified: boolean;
}

interface DocumentsTabProps {
  profile: BabysitterProfile | null;
  uploadingDoc: string | null;
  onDocumentUpload: (e: React.ChangeEvent<HTMLInputElement>, documentType: string) => void;
  onVerifyPhone: () => void;
}

export default function DocumentsTab({ profile, uploadingDoc, onDocumentUpload, onVerifyPhone }: DocumentsTabProps) {
  const govIdFrontRef = useRef<HTMLInputElement>(null);
  const policeCheckRef = useRef<HTMLInputElement>(null);
  const cprCertRef = useRef<HTMLInputElement>(null);

  const documents = [
    {
      key: 'governmentIdFront',
      label: 'Government ID',
      icon: ShieldCheckIcon,
      uploaded: !!profile?.governmentIdFront,
      ref: govIdFrontRef,
    },
    {
      key: 'policeCheck',
      label: 'Vulnerable Sector Check',
      icon: DocumentTextIcon,
      uploaded: !!profile?.policeCheck,
      ref: policeCheckRef,
    },
    {
      key: 'cprCertificate',
      label: 'CPR/First Aid Certificate',
      icon: CheckCircleIcon,
      uploaded: !!profile?.cprCertificate,
      optionalLabel: 'Optional - ',
      ref: cprCertRef,
    },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Verification Documents</h3>

      {/* Hidden file inputs */}
      {documents.map((doc) => (
        <input
          key={doc.key}
          type="file"
          ref={doc.ref}
          accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
          onChange={(e) => onDocumentUpload(e, doc.key)}
          className="hidden"
        />
      ))}

      <div className="space-y-6">
        {documents.map((doc) => {
          const Icon = doc.icon;
          return (
            <div key={doc.key} className="border dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${doc.uploaded ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <Icon className={`h-6 w-6 ${doc.uploaded ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{doc.label}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {doc.uploaded ? 'Uploaded' : `${doc.optionalLabel || ''}Not uploaded`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => doc.ref.current?.click()}
                  disabled={uploadingDoc === doc.key}
                  className={`px-4 py-2 text-sm rounded-lg transition ${
                    uploadingDoc === doc.key
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                      : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  } disabled:cursor-not-allowed`}
                >
                  {uploadingDoc === doc.key ? (
                    <span className="flex items-center">
                      <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                      Uploading...
                    </span>
                  ) : (
                    doc.uploaded ? 'Replace' : 'Upload'
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* Phone Verification */}
        <div className="border dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${profile?.phoneVerified ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                <PhoneIcon className={`h-6 w-6 ${profile?.phoneVerified ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
              </div>
              <div>
                <h4 className="font-medium text-gray-900 dark:text-white">Phone Verification</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {profile?.phoneVerified ? 'Verified' : 'Not verified'}
                </p>
              </div>
            </div>
            {!profile?.phoneVerified && (
              <button
                onClick={onVerifyPhone}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Verify Now
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
