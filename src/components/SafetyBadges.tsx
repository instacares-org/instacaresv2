"use client";

import { 
  ShieldCheckIcon, 
  IdentificationIcon, 
  DocumentCheckIcon, 
  HeartIcon,
  StarIcon,
  ExclamationTriangleIcon 
} from "@heroicons/react/24/outline";
import { 
  ShieldCheckIcon as ShieldCheckSolid,
  IdentificationIcon as IdentificationSolid,
  DocumentCheckIcon as DocumentCheckSolid,
  HeartIcon as HeartSolid 
} from "@heroicons/react/24/solid";

export interface VerificationData {
  backgroundCheck: boolean;
  backgroundCheckDate?: string;
  idVerificationStatus?: string;
  insuranceStatus?: string;
  insuranceProvider?: string;
  insuranceExpiryDate?: string;
  verificationScore?: number;
  certifications?: Array<{
    type: string;
    title: string;
    isVerified: boolean;
    expirationDate?: string;
  }>;
}

interface SafetyBadgesProps {
  verification?: VerificationData;
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

export default function SafetyBadges({ 
  verification, 
  compact = false, 
  showDetails = false,
  className = "" 
}: SafetyBadgesProps) {
  if (!verification) {
    return null;
  }

  const getBadgeColor = (status: string | boolean | undefined) => {
    if (status === true || status === 'APPROVED') return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
    if (status === 'PENDING' || status === 'IN_PROGRESS') return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-300';
    if (status === 'REJECTED' || status === 'EXPIRED') return 'text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300';
    return 'text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400';
  };

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-gray-500';
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const badges = [
    {
      id: 'background',
      label: 'Background Check',
      status: verification.backgroundCheck,
      icon: verification.backgroundCheck ? ShieldCheckSolid : ShieldCheckIcon,
      detail: verification.backgroundCheckDate ? `Verified ${new Date(verification.backgroundCheckDate).toLocaleDateString()}` : undefined
    },
    {
      id: 'id',
      label: 'ID Verified',
      status: verification.idVerificationStatus,
      icon: verification.idVerificationStatus === 'APPROVED' ? IdentificationSolid : IdentificationIcon,
      detail: 'Government ID verified'
    },
    {
      id: 'insurance',
      label: 'Insured',
      status: verification.insuranceStatus,
      icon: verification.insuranceStatus === 'APPROVED' ? DocumentCheckSolid : DocumentCheckIcon,
      detail: verification.insuranceProvider ? `${verification.insuranceProvider} • Expires ${verification.insuranceExpiryDate ? new Date(verification.insuranceExpiryDate).toLocaleDateString() : 'N/A'}` : undefined
    }
  ];

  if (compact) {
    return (
      <div className={`flex items-center space-x-1 ${className}`}>
        {badges.map(badge => {
          const IconComponent = badge.icon;
          return (
            <div
              key={badge.id}
              className={`p-1 rounded-full ${getBadgeColor(badge.status)}`}
              title={badge.label}
            >
              <IconComponent className="h-3 w-3" />
            </div>
          );
        })}
        {verification.verificationScore && (
          <div className={`text-xs font-medium ${getScoreColor(verification.verificationScore)}`}>
            {verification.verificationScore}%
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Verification Score */}
      {verification.verificationScore && (
        <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center">
            <StarIcon className="h-4 w-4 text-yellow-500 mr-2" />
            <span className="text-sm font-medium text-gray-900 dark:text-white">Trust Score</span>
          </div>
          <span className={`text-sm font-bold ${getScoreColor(verification.verificationScore)}`}>
            {verification.verificationScore}%
          </span>
        </div>
      )}

      {/* Verification Badges */}
      <div className="grid grid-cols-1 gap-2">
        {badges.map(badge => {
          const IconComponent = badge.icon;
          const isVerified = badge.status === true || badge.status === 'APPROVED';
          
          return (
            <div
              key={badge.id}
              className={`flex items-center p-2 rounded-lg border ${
                isVerified 
                  ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' 
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
              }`}
            >
              <div className={`p-1.5 rounded-full mr-3 ${getBadgeColor(badge.status)}`}>
                <IconComponent className="h-4 w-4" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {badge.label}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${getBadgeColor(badge.status)}`}>
                    {typeof badge.status === 'boolean' 
                      ? (badge.status ? 'Verified' : 'Unverified')
                      : badge.status || 'Pending'
                    }
                  </span>
                </div>
                
                {showDetails && badge.detail && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {badge.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Certifications */}
      {verification.certifications && verification.certifications.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Certifications</h4>
          <div className="space-y-1">
            {verification.certifications.map((cert, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 rounded ${
                  cert.isVerified 
                    ? 'bg-green-50 dark:bg-green-900/20' 
                    : 'bg-gray-50 dark:bg-gray-800'
                }`}
              >
                <div className="flex items-center">
                  {cert.isVerified ? (
                    <HeartSolid className="h-3 w-3 text-green-600 dark:text-green-400 mr-2" />
                  ) : (
                    <ExclamationTriangleIcon className="h-3 w-3 text-yellow-600 dark:text-yellow-400 mr-2" />
                  )}
                  <span className="text-xs font-medium text-gray-900 dark:text-white">
                    {cert.title}
                  </span>
                </div>
                
                {cert.expirationDate && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Expires {new Date(cert.expirationDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}