'use client';

import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface PasswordRequirement {
  label: string;
  regex?: RegExp;
  validator?: (password: string) => boolean;
}

interface PasswordStrengthIndicatorProps {
  password: string;
  showRequirements?: boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  {
    label: 'At least 8 characters',
    validator: (password: string) => password.length >= 8
  },
  {
    label: 'One uppercase letter',
    regex: /[A-Z]/
  },
  {
    label: 'One lowercase letter',
    regex: /[a-z]/
  },
  {
    label: 'One number',
    regex: /\d/
  },
  {
    label: 'One special character (@$!%*?&)',
    regex: /[@$!%*?&]/
  }
];

const commonPasswords = [
  'password', 'Password', 'password123', 'Password123', '12345678',
  'qwerty', 'abc123', 'monkey', '1234567890', 'letmein',
  'password1', 'qwerty123', 'welcome', 'admin', 'iloveyou'
];

export default function PasswordStrengthIndicator({
  password,
  showRequirements = true
}: PasswordStrengthIndicatorProps) {
  const checkRequirement = (requirement: PasswordRequirement): boolean => {
    if (requirement.validator) {
      return requirement.validator(password);
    }
    if (requirement.regex) {
      return requirement.regex.test(password);
    }
    return false;
  };

  const isCommonPassword = () => {
    const lowerPassword = password.toLowerCase();
    return commonPasswords.some(common =>
      lowerPassword === common.toLowerCase() ||
      lowerPassword.includes(common.toLowerCase())
    );
  };

  const calculateStrength = () => {
    if (!password) return 0;

    let strength = 0;
    const metRequirements = passwordRequirements.filter(req => checkRequirement(req)).length;

    // Base strength from requirements
    strength = (metRequirements / passwordRequirements.length) * 70;

    // Bonus for length
    if (password.length >= 12) strength += 15;
    if (password.length >= 16) strength += 15;

    // Penalty for common passwords
    if (isCommonPassword()) {
      strength = Math.min(strength, 25);
    }

    return Math.min(100, strength);
  };

  const getStrengthColor = (strength: number) => {
    if (strength < 30) return 'bg-red-500';
    if (strength < 50) return 'bg-orange-500';
    if (strength < 70) return 'bg-yellow-500';
    if (strength < 90) return 'bg-lime-500';
    return 'bg-green-500';
  };

  const getStrengthText = (strength: number) => {
    if (!password) return '';
    if (strength < 30) return 'Very Weak';
    if (strength < 50) return 'Weak';
    if (strength < 70) return 'Fair';
    if (strength < 90) return 'Good';
    return 'Strong';
  };

  const strength = calculateStrength();
  const strengthColor = getStrengthColor(strength);
  const strengthText = getStrengthText(strength);
  const hasCommonPassword = password && isCommonPassword();

  if (!password && !showRequirements) return null;

  return (
    <div className="mt-2 space-y-2">
      {password && (
        <>
          {/* Strength Bar */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-700">Password Strength</span>
              <span className={`text-xs font-medium ${
                strength >= 70 ? 'text-green-600' :
                strength >= 50 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {strengthText}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${strengthColor}`}
                style={{ width: `${strength}%` }}
              />
            </div>
          </div>

          {/* Common Password Warning */}
          {hasCommonPassword && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-xs">
              ⚠️ This password is too common and easily guessable. Please choose a unique password.
            </div>
          )}
        </>
      )}

      {/* Requirements Checklist */}
      {showRequirements && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs font-medium text-gray-700 mb-2">Password Requirements:</p>
          <ul className="space-y-1">
            {passwordRequirements.map((req, index) => {
              const isMet = password ? checkRequirement(req) : false;
              return (
                <li key={index} className="flex items-center text-xs">
                  {isMet ? (
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-300 mr-2 flex-shrink-0" />
                  )}
                  <span className={isMet ? 'text-green-700' : 'text-gray-600'}>
                    {req.label}
                  </span>
                </li>
              );
            })}
            {!hasCommonPassword && password && (
              <li className="flex items-center text-xs">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                <span className="text-green-700">Not a common password</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}