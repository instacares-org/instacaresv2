import { z } from 'zod';

// Password validation schema using Zod
export const passwordValidationSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[@$!%*?&]/, 'Password must contain at least one special character (@$!%*?&)')
  .refine((password) => {
    // Check against common weak passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      '1234567890', 'login', 'pass', 'master', 'hello',
      'princess', 'dragon', 'shadow', 'joshua', 'michael'
    ];
    return !commonPasswords.includes(password.toLowerCase());
  }, 'Password is too common and easily guessable')
  .refine((password) => {
    // Check for keyboard patterns
    const patterns = ['123456', 'qwerty', 'asdfgh', 'zxcvbn'];
    return !patterns.some(pattern => password.toLowerCase().includes(pattern));
  }, 'Password contains common keyboard patterns')
  .refine((password) => {
    // Check for repeated characters (more than 3 consecutive)
    return !/(.)\1{3,}/.test(password);
  }, 'Password contains too many repeated characters')
  .refine((password) => {
    // Check for sequential characters
    const sequential = ['abc', 'bcd', 'cde', '123', '234', '345', '456', '567', '678', '789'];
    const lowerPassword = password.toLowerCase();
    return !sequential.some(seq => lowerPassword.includes(seq));
  }, 'Password contains sequential characters');

// Password strength levels
export enum PasswordStrength {
  VERY_WEAK = 0,
  WEAK = 1,
  FAIR = 2,
  GOOD = 3,
  STRONG = 4,
  VERY_STRONG = 5
}

// Password validation result
export interface PasswordValidationResult {
  isValid: boolean;
  strength: PasswordStrength;
  score: number;
  issues: string[];
  suggestions: string[];
}

// Calculate password entropy (bits of randomness)
export function calculatePasswordEntropy(password: string): number {
  let charset = 0;
  
  if (/[a-z]/.test(password)) charset += 26;
  if (/[A-Z]/.test(password)) charset += 26;
  if (/[0-9]/.test(password)) charset += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charset += 32; // Special characters
  
  return Math.log2(Math.pow(charset, password.length));
}

// Comprehensive password validation
export function validatePassword(password: string): PasswordValidationResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;
  
  // Basic requirements
  if (password.length < 8) {
    issues.push('Password must be at least 8 characters long');
    suggestions.push('Use at least 8 characters');
  } else if (password.length >= 8) {
    score += 1;
  }
  
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  if (password.length > 128) {
    issues.push('Password must not exceed 128 characters');
  }
  
  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);
  const hasExtendedSpecial = /[^a-zA-Z0-9@$!%*?&]/.test(password);
  
  if (!hasLower) {
    issues.push('Password must contain at least one lowercase letter');
    suggestions.push('Add lowercase letters (a-z)');
  } else score += 1;
  
  if (!hasUpper) {
    issues.push('Password must contain at least one uppercase letter');
    suggestions.push('Add uppercase letters (A-Z)');
  } else score += 1;
  
  if (!hasNumber) {
    issues.push('Password must contain at least one number');
    suggestions.push('Add numbers (0-9)');
  } else score += 1;
  
  if (!hasSpecial) {
    issues.push('Password must contain at least one special character (@$!%*?&)');
    suggestions.push('Add special characters (@$!%*?&)');
  } else score += 1;
  
  if (hasExtendedSpecial) score += 1;
  
  // Check for common weak passwords
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123', 
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    '1234567890', 'login', 'pass', 'master', 'hello',
    'princess', 'dragon', 'shadow', 'joshua', 'michael'
  ];
  
  if (commonPasswords.includes(password.toLowerCase())) {
    issues.push('Password is too common and easily guessable');
    suggestions.push('Use a unique password that\'s not commonly used');
    score = Math.max(0, score - 2);
  }
  
  // Check for keyboard patterns
  const patterns = ['123456', 'qwerty', 'asdfgh', 'zxcvbn', '111111', 'aaaaaa'];
  if (patterns.some(pattern => password.toLowerCase().includes(pattern))) {
    issues.push('Password contains common patterns');
    suggestions.push('Avoid keyboard patterns and repeated characters');
    score = Math.max(0, score - 1);
  }
  
  // Check for repeated characters
  if (/(.)\1{3,}/.test(password)) {
    issues.push('Password contains too many repeated characters');
    suggestions.push('Use a variety of different characters');
    score = Math.max(0, score - 1);
  }
  
  // Check for dictionary words (basic check)
  const commonWords = ['password', 'admin', 'user', 'test', 'login', 'welcome'];
  if (commonWords.some(word => password.toLowerCase().includes(word))) {
    issues.push('Password contains common dictionary words');
    suggestions.push('Avoid using common words');
    score = Math.max(0, score - 1);
  }
  
  // Bonus points for complexity
  const uniqueChars = new Set(password).size;
  if (uniqueChars >= password.length * 0.7) score += 1;
  
  // Calculate entropy
  const entropy = calculatePasswordEntropy(password);
  if (entropy >= 50) score += 1;
  if (entropy >= 70) score += 1;
  
  // Determine strength level
  let strength: PasswordStrength;
  if (score <= 1) strength = PasswordStrength.VERY_WEAK;
  else if (score <= 3) strength = PasswordStrength.WEAK;
  else if (score <= 5) strength = PasswordStrength.FAIR;
  else if (score <= 7) strength = PasswordStrength.GOOD;
  else if (score <= 9) strength = PasswordStrength.STRONG;
  else strength = PasswordStrength.VERY_STRONG;
  
  // Add suggestions based on strength
  if (strength <= PasswordStrength.FAIR) {
    if (password.length < 12) suggestions.push('Consider using at least 12 characters');
    if (!hasExtendedSpecial) suggestions.push('Consider adding symbols like #, %, ^, etc.');
    suggestions.push('Use a passphrase with multiple words');
  }
  
  return {
    isValid: issues.length === 0 && strength >= PasswordStrength.FAIR,
    strength,
    score,
    issues,
    suggestions
  };
}

// Generate a cryptographically secure password
export function generateSecurePassword(length: number = 16): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '@$!%*?&';
  const allChars = lowercase + uppercase + numbers + special;
  
  // Generate cryptographically secure random bytes
  const randomBytes = new Uint8Array(length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Web Crypto API
    crypto.getRandomValues(randomBytes);
  } else {
    // Node.js crypto module fallback
    try {
      const nodeCrypto = require('crypto');
      nodeCrypto.randomFillSync(randomBytes);
    } catch (error) {
      throw new Error('No secure random number generator available');
    }
  }
  
  let password = '';
  
  // Ensure at least one character from each category using secure random
  const categoryBytes = new Uint8Array(4);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(categoryBytes);
  } else {
    try {
      const nodeCrypto = require('crypto');
      nodeCrypto.randomFillSync(categoryBytes);
    } catch (error) {
      throw new Error('No secure random number generator available');
    }
  }
  
  password += lowercase[categoryBytes[0] % lowercase.length];
  password += uppercase[categoryBytes[1] % uppercase.length];
  password += numbers[categoryBytes[2] % numbers.length];
  password += special[categoryBytes[3] % special.length];
  
  // Fill the rest with cryptographically secure random characters
  for (let i = 4; i < length; i++) {
    password += allChars[randomBytes[i] % allChars.length];
  }
  
  // Cryptographically secure shuffle using Fisher-Yates
  const passwordArray = password.split('');
  const shuffleBytes = new Uint8Array(passwordArray.length);
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(shuffleBytes);
  } else {
    try {
      const nodeCrypto = require('crypto');
      nodeCrypto.randomFillSync(shuffleBytes);
    } catch (error) {
      throw new Error('No secure random number generator available');
    }
  }
  
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }
  
  return passwordArray.join('');
}

// Password strength text and colors for UI
export function getPasswordStrengthText(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.VERY_WEAK: return 'Very Weak';
    case PasswordStrength.WEAK: return 'Weak';
    case PasswordStrength.FAIR: return 'Fair';
    case PasswordStrength.GOOD: return 'Good';
    case PasswordStrength.STRONG: return 'Strong';
    case PasswordStrength.VERY_STRONG: return 'Very Strong';
    default: return 'Unknown';
  }
}

export function getPasswordStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case PasswordStrength.VERY_WEAK: return '#dc2626'; // red-600
    case PasswordStrength.WEAK: return '#ea580c'; // orange-600
    case PasswordStrength.FAIR: return '#d97706'; // amber-600
    case PasswordStrength.GOOD: return '#65a30d'; // lime-600
    case PasswordStrength.STRONG: return '#16a34a'; // green-600
    case PasswordStrength.VERY_STRONG: return '#059669'; // emerald-600
    default: return '#6b7280'; // gray-500
  }
}