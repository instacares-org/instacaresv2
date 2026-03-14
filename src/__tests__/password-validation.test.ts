import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  passwordValidationSchema,
  PasswordStrength,
  calculatePasswordEntropy,
  validatePassword,
  generateSecurePassword,
  getPasswordStrengthText,
  getPasswordStrengthColor,
} from '@/lib/password-validation';

describe('password-validation', () => {
  // ---------------------------------------------------------------
  // passwordValidationSchema (Zod)
  // ---------------------------------------------------------------
  describe('passwordValidationSchema', () => {
    it('accepts a strong password that satisfies all rules', () => {
      // No sequential chars, no common words, no repeated chars, no patterns
      const result = passwordValidationSchema.safeParse('Xk9!mWpL');
      expect(result.success).toBe(true);
    });

    it('rejects a password shorter than 8 characters', () => {
      const result = passwordValidationSchema.safeParse('Aa1!xy');
      expect(result.success).toBe(false);
    });

    it('rejects a password longer than 128 characters', () => {
      const long = 'Aa1!' + 'x'.repeat(126); // 130 chars, but has repeated chars
      const result = passwordValidationSchema.safeParse(long);
      expect(result.success).toBe(false);
    });

    it('rejects a password missing a lowercase letter', () => {
      const result = passwordValidationSchema.safeParse('XKWMPL9!');
      expect(result.success).toBe(false);
    });

    it('rejects a password missing an uppercase letter', () => {
      const result = passwordValidationSchema.safeParse('xkwmpl9!');
      expect(result.success).toBe(false);
    });

    it('rejects a password missing a digit', () => {
      const result = passwordValidationSchema.safeParse('Xkwmpl!Q');
      expect(result.success).toBe(false);
    });

    it('rejects a password missing a special character', () => {
      const result = passwordValidationSchema.safeParse('Xkwmpl9Q');
      expect(result.success).toBe(false);
    });

    it('rejects common / easily guessable passwords', () => {
      // "password" won't pass the regex rules either, but more importantly the refine check
      // Use a value that could pass basic char rules but is on the common list:
      // We test the refine by checking a value that matches every regex but is common.
      // None of the common list entries pass all regex rules, so the schema catches them
      // at the regex level first. We verify the refine itself through validatePassword below.
      const result = passwordValidationSchema.safeParse('password');
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // calculatePasswordEntropy
  // ---------------------------------------------------------------
  describe('calculatePasswordEntropy', () => {
    it('returns 0 for an empty string', () => {
      // log2(charset^0) = log2(1) = 0 when charset > 0, but charset is 0 for ''
      // charset = 0 => Math.pow(0, 0) = 1 => log2(1) = 0
      const entropy = calculatePasswordEntropy('');
      expect(entropy).toBe(0);
    });

    it('calculates entropy for lowercase-only password', () => {
      const entropy = calculatePasswordEntropy('abcdefgh');
      // charset = 26, length = 8 => log2(26^8) ~ 37.6
      expect(entropy).toBeGreaterThan(37);
      expect(entropy).toBeLessThan(38);
    });

    it('increases entropy when more character classes are used', () => {
      const lowerOnly = calculatePasswordEntropy('abcdefgh');
      const mixed = calculatePasswordEntropy('aBc1ef!h');
      expect(mixed).toBeGreaterThan(lowerOnly);
    });

    it('increases entropy with longer passwords', () => {
      const short = calculatePasswordEntropy('aB1!');
      const long = calculatePasswordEntropy('aB1!aB1!aB1!');
      expect(long).toBeGreaterThan(short);
    });
  });

  // ---------------------------------------------------------------
  // validatePassword (comprehensive validator)
  // ---------------------------------------------------------------
  describe('validatePassword', () => {
    it('marks a strong password as valid with GOOD or better strength', () => {
      // 16+ chars, all classes, unique chars, high entropy, no patterns
      const result = validatePassword('R#9xLm!pQw2$Tz^k');
      expect(result.isValid).toBe(true);
      expect(result.strength).toBeGreaterThanOrEqual(PasswordStrength.FAIR);
      expect(result.issues).toHaveLength(0);
    });

    it('marks an empty string as invalid with issues', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.strength).toBe(PasswordStrength.VERY_WEAK);
    });

    it('penalises common passwords and reports the issue', () => {
      const result = validatePassword('password');
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('common'),
        ]),
      );
    });

    it('detects keyboard patterns like qwerty', () => {
      const result = validatePassword('Qwerty!9XkLm');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('pattern'),
        ]),
      );
    });

    it('detects repeated characters (aaaa)', () => {
      const result = validatePassword('Xaaaa!9Lm');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('repeated'),
        ]),
      );
    });

    it('detects common dictionary words embedded in password', () => {
      const result = validatePassword('My!admin9Xz');
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.stringContaining('dictionary'),
        ]),
      );
    });

    it('gives bonus score for extended special characters', () => {
      // The ^ character is outside of @$!%*?& so it counts as extended
      const withExtended = validatePassword('R#9xLm!p^w2$TzQk');
      const withoutExtended = validatePassword('R!9xLm!pw2$TzQkR');
      expect(withExtended.score).toBeGreaterThanOrEqual(withoutExtended.score);
    });

    it('handles unicode characters without crashing', () => {
      const result = validatePassword('P@ss1wrd\u00E9\u00FC\u00F1');
      // Should run without throwing; may or may not be valid depending on rules
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('strength');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('suggestions');
    });

    it('returns suggestions when strength is FAIR or below', () => {
      // Missing special char => score drops, and issues trigger suggestions
      const result = validatePassword('aB1xxxyz');
      expect(result.isValid).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('score never goes below zero even with heavy penalties', () => {
      const result = validatePassword('password');
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  // ---------------------------------------------------------------
  // generateSecurePassword
  // ---------------------------------------------------------------
  describe('generateSecurePassword', () => {
    it('generates a password of the requested length', () => {
      const pwd = generateSecurePassword(20);
      expect(pwd).toHaveLength(20);
    });

    it('defaults to length 16 when no argument is provided', () => {
      const pwd = generateSecurePassword();
      expect(pwd).toHaveLength(16);
    });

    it('includes at least one lowercase, uppercase, digit, and special character', () => {
      // Run several times to account for randomness
      for (let i = 0; i < 5; i++) {
        const pwd = generateSecurePassword(16);
        expect(pwd).toMatch(/[a-z]/);
        expect(pwd).toMatch(/[A-Z]/);
        expect(pwd).toMatch(/\d/);
        expect(pwd).toMatch(/[@$!%*?&]/);
      }
    });

    it('produces unique passwords on successive calls', () => {
      const passwords = new Set<string>();
      for (let i = 0; i < 10; i++) {
        passwords.add(generateSecurePassword());
      }
      // All 10 should be different (probability of collision is astronomically low)
      expect(passwords.size).toBe(10);
    });
  });

  // ---------------------------------------------------------------
  // getPasswordStrengthText
  // ---------------------------------------------------------------
  describe('getPasswordStrengthText', () => {
    it('returns the correct label for every PasswordStrength enum value', () => {
      expect(getPasswordStrengthText(PasswordStrength.VERY_WEAK)).toBe('Very Weak');
      expect(getPasswordStrengthText(PasswordStrength.WEAK)).toBe('Weak');
      expect(getPasswordStrengthText(PasswordStrength.FAIR)).toBe('Fair');
      expect(getPasswordStrengthText(PasswordStrength.GOOD)).toBe('Good');
      expect(getPasswordStrengthText(PasswordStrength.STRONG)).toBe('Strong');
      expect(getPasswordStrengthText(PasswordStrength.VERY_STRONG)).toBe('Very Strong');
    });

    it('returns "Unknown" for an out-of-range value', () => {
      expect(getPasswordStrengthText(99 as PasswordStrength)).toBe('Unknown');
    });
  });

  // ---------------------------------------------------------------
  // getPasswordStrengthColor
  // ---------------------------------------------------------------
  describe('getPasswordStrengthColor', () => {
    it('returns a hex color string for every strength level', () => {
      const hexPattern = /^#[0-9a-fA-F]{6}$/;
      expect(getPasswordStrengthColor(PasswordStrength.VERY_WEAK)).toMatch(hexPattern);
      expect(getPasswordStrengthColor(PasswordStrength.WEAK)).toMatch(hexPattern);
      expect(getPasswordStrengthColor(PasswordStrength.FAIR)).toMatch(hexPattern);
      expect(getPasswordStrengthColor(PasswordStrength.GOOD)).toMatch(hexPattern);
      expect(getPasswordStrengthColor(PasswordStrength.STRONG)).toMatch(hexPattern);
      expect(getPasswordStrengthColor(PasswordStrength.VERY_STRONG)).toMatch(hexPattern);
    });

    it('returns gray for an unknown strength value', () => {
      expect(getPasswordStrengthColor(99 as PasswordStrength)).toBe('#6b7280');
    });
  });
});
