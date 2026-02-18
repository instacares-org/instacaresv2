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

  const getBadgeColor = (status: string | boolean | undefined, badgeType?: string) => {
    if (status === true || status === 'APPROVED') {
      // Use brand colors for different verification types
      if (badgeType === 'background') return 'text-teal-700 bg-teal-100 dark:bg-teal-900 dark:text-teal-300';
      if (badgeType === 'id') return 'text-rose-700 bg-rose-100 dark:bg-rose-900 dark:text-rose-300';
      if (badgeType === 'insurance') return 'text-purple-700 bg-purple-100 dark:bg-purple-900 dark:text-purple-300';
      return 'text-teal-700 bg-teal-100 dark:bg-teal-900 dark:text-teal-300'; // Default to teal for verified
    }
    if (status === 'PENDING' || status === 'IN_PROGRESS') return 'text-amber-700 bg-amber-100 dark:bg-amber-900 dark:text-amber-300';
    if (status === 'REJECTED' || status === 'EXPIRED') return 'text-rose-700 bg-rose-100 dark:bg-rose-900 dark:text-rose-300';
    return 'text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400';
  };

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-gray-500';
    if (score >= 90) return 'text-teal-600 dark:text-teal-400';
    if (score >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  const getBorderColorForBadge = (badgeType: string) => {
    switch (badgeType) {
      case 'background':
        return 'border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20';
      case 'id':
        return 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20';
      case 'insurance':
        return 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20';
      default:
        return 'border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20';
    }
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
              className={`p-1 rounded-full ${getBadgeColor(badge.status, badge.id)}`}
              title={badge.label}
            >
              <IconComponent className="h-3 w-3" />
            </div>
          );
        })}
        {verification.verificationScore && (
          <div className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${getScoreColor(verification.verificationScore)} bg-white dark:bg-gray-800 shadow-sm border`}>
            {verification.verificationScore}%
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Verification Score - Brand Aligned */}
      {verification.verificationScore && (
        <div className="flex items-center justify-between p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
          <div className="flex items-center">
            <StarIcon className="h-4 w-4 text-amber-600 mr-2" />
            <span className="text-sm font-medium text-teal-900 dark:text-teal-100">Trust Score</span>
          </div>
          <span className={`text-sm font-bold px-2 py-1 rounded-full ${getScoreColor(verification.verificationScore)} bg-white dark:bg-gray-800 shadow-sm`}>
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
                  ? getBorderColorForBadge(badge.id)
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
              }`}
            >
              <div className={`p-1.5 rounded-full mr-3 ${getBadgeColor(badge.status, badge.id)}`}>
                <IconComponent className="h-4 w-4" />
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {badge.label}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${getBadgeColor(badge.status, badge.id)}`}>
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
                    ? 'bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800' 
                    : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className="flex items-center">
                  {cert.isVerified ? (
                    <HeartSolid className="h-3 w-3 text-teal-600 dark:text-teal-400 mr-2" />
                  ) : (
                    <ExclamationTriangleIcon className="h-3 w-3 text-amber-600 dark:text-amber-400 mr-2" />
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