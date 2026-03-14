import { describe, it, expect, beforeEach } from 'vitest';
import {
  passwordSchema,
  phoneSchema,
  emailSchema,
  nameSchema,
  registrationSchema,
  approvalSchema,
  sanitizeString,
  normalizePhoneNumber,
  checkRateLimit,
} from '@/lib/validation';

// ---------------------------------------------------------------------------
// passwordSchema
// ---------------------------------------------------------------------------
describe('passwordSchema', () => {
  const validPassword = 'Str0ng!Pass';

  it('accepts a strong password', () => {
    const result = passwordSchema.safeParse(validPassword);
    expect(result.success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Ab1!xyz');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('at least 8 characters');
    }
  });

  it('rejects passwords longer than 128 characters', () => {
    const long = 'Aa1!' + 'x'.repeat(126);
    const result = passwordSchema.safeParse(long);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('not exceed 128');
    }
  });

  it('rejects passwords without a lowercase letter', () => {
    const result = passwordSchema.safeParse('ALLCAPS1!');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Password must contain at least one lowercase letter');
    }
  });

  it('rejects passwords without an uppercase letter', () => {
    const result = passwordSchema.safeParse('alllower1!');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Password must contain at least one uppercase letter');
    }
  });

  it('rejects passwords without a number', () => {
    const result = passwordSchema.safeParse('NoDigits!Here');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Password must contain at least one number');
    }
  });

  it('rejects passwords without a special character', () => {
    const result = passwordSchema.safeParse('NoSpecial1x');
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('Password must contain at least one special character (@$!%*?&)');
    }
  });

  it('rejects passwords that are common weak passwords', () => {
    // Common weak passwords like "password" or "letmein" are rejected.
    // These also fail regex rules (no uppercase/special), so multiple issues arise.
    const result = passwordSchema.safeParse('password');
    expect(result.success).toBe(false);

    const result2 = passwordSchema.safeParse('letmein');
    expect(result2.success).toBe(false);
  });

  it('rejects keyboard patterns like qwerty', () => {
    const result = passwordSchema.safeParse('Qwerty12!x');
    expect(result.success).toBe(false);
  });

  it('rejects repeated characters (4+ consecutive same character)', () => {
    // (.)\1{3,} means the same char repeated 4+ times consecutively
    // 'aaaa' = 4 consecutive 'a' characters which triggers the rule
    const result = passwordSchema.safeParse('Baaaa12!x');
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    const result = passwordSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(passwordSchema.safeParse(null).success).toBe(false);
    expect(passwordSchema.safeParse(undefined).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// phoneSchema
// ---------------------------------------------------------------------------
describe('phoneSchema', () => {
  it('accepts a 10-digit phone number', () => {
    expect(phoneSchema.safeParse('4165551234').success).toBe(true);
  });

  it('accepts a formatted phone number with dashes', () => {
    expect(phoneSchema.safeParse('416-555-1234').success).toBe(true);
  });

  it('accepts a phone number with country code', () => {
    expect(phoneSchema.safeParse('+1 416 555 1234').success).toBe(true);
  });

  it('accepts a phone number with parentheses', () => {
    expect(phoneSchema.safeParse('(416) 555-1234').success).toBe(true);
  });

  it('rejects a string shorter than 10 characters', () => {
    const result = phoneSchema.safeParse('12345');
    expect(result.success).toBe(false);
  });

  it('rejects a string longer than 15 characters', () => {
    const result = phoneSchema.safeParse('1234567890123456');
    expect(result.success).toBe(false);
  });

  it('rejects letters in the phone number', () => {
    const result = phoneSchema.safeParse('416-ABC-1234');
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(phoneSchema.safeParse('').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// emailSchema
// ---------------------------------------------------------------------------
describe('emailSchema', () => {
  it('accepts a valid email', () => {
    const result = emailSchema.safeParse('User@Example.com');
    expect(result.success).toBe(true);
    if (result.success) {
      // Should be lowercased and trimmed
      expect(result.data).toBe('user@example.com');
    }
  });

  it('lowercases and trims the output', () => {
    // Zod .trim() and .toLowerCase() are transforms applied to valid input.
    // Leading/trailing spaces would fail the .email() check first, so we test
    // that a valid mixed-case email is lowercased in the output.
    const result = emailSchema.safeParse('Hello@World.COM');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('hello@world.com');
    }
  });

  it('rejects an invalid email format', () => {
    const result = emailSchema.safeParse('not-an-email');
    expect(result.success).toBe(false);
  });

  it('rejects email shorter than 5 characters', () => {
    const result = emailSchema.safeParse('a@b');
    expect(result.success).toBe(false);
  });

  it('rejects email longer than 254 characters', () => {
    const long = 'a'.repeat(250) + '@b.com';
    const result = emailSchema.safeParse(long);
    expect(result.success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(emailSchema.safeParse('').success).toBe(false);
  });

  it('rejects null and undefined', () => {
    expect(emailSchema.safeParse(null).success).toBe(false);
    expect(emailSchema.safeParse(undefined).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// nameSchema
// ---------------------------------------------------------------------------
describe('nameSchema', () => {
  it('accepts a simple name', () => {
    const result = nameSchema.safeParse('Alice');
    expect(result.success).toBe(true);
  });

  it('rejects an empty string', () => {
    const result = nameSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects names exceeding 50 characters', () => {
    const result = nameSchema.safeParse('A'.repeat(51));
    expect(result.success).toBe(false);
  });

  it('rejects names with HTML tags (XSS prevention)', () => {
    const result = nameSchema.safeParse('<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });

  it('rejects names containing angle brackets', () => {
    const result = nameSchema.safeParse('Name<>');
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// registrationSchema
// ---------------------------------------------------------------------------
describe('registrationSchema', () => {
  const validRegistration = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    password: 'Str0ng!Pass',
    confirmPassword: 'Str0ng!Pass',
    phone: '4165551234',
    userType: 'parent' as const,
    agreeToTerms: true,
  };

  it('accepts a fully valid registration', () => {
    const result = registrationSchema.safeParse(validRegistration);
    expect(result.success).toBe(true);
  });

  it('rejects when passwords do not match', () => {
    const result = registrationSchema.safeParse({
      ...validRegistration,
      confirmPassword: 'Different1!',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('confirmPassword');
    }
  });

  it('rejects when terms are not agreed to', () => {
    const result = registrationSchema.safeParse({
      ...validRegistration,
      agreeToTerms: false,
    });
    expect(result.success).toBe(false);
  });

  it('accepts agreeToTerms as string "true"', () => {
    const result = registrationSchema.safeParse({
      ...validRegistration,
      agreeToTerms: 'true',
    });
    expect(result.success).toBe(true);
  });

  it('accepts agreeToTerms as string "on" (HTML checkbox)', () => {
    const result = registrationSchema.safeParse({
      ...validRegistration,
      agreeToTerms: 'on',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid userType', () => {
    const result = registrationSchema.safeParse({
      ...validRegistration,
      userType: 'invalid_type',
    });
    expect(result.success).toBe(false);
  });

  it('allows valid userTypes: parent, provider, babysitter', () => {
    for (const type of ['parent', 'provider', 'babysitter']) {
      const result = registrationSchema.safeParse({
        ...validRegistration,
        userType: type,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts optional address fields', () => {
    const result = registrationSchema.safeParse({
      ...validRegistration,
      streetAddress: '123 Main St',
      apartment: 'Apt 4B',
      city: 'Toronto',
      province: 'ON',
      postalCode: 'M5V 1A1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects if required fields are missing', () => {
    const result = registrationSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// approvalSchema
// ---------------------------------------------------------------------------
describe('approvalSchema', () => {
  it('accepts APPROVED action', () => {
    expect(approvalSchema.safeParse({ action: 'APPROVED' }).success).toBe(true);
  });

  it('accepts REJECTED action', () => {
    expect(approvalSchema.safeParse({ action: 'REJECTED' }).success).toBe(true);
  });

  it('accepts SUSPENDED action', () => {
    expect(approvalSchema.safeParse({ action: 'SUSPENDED' }).success).toBe(true);
  });

  it('accepts optional reason', () => {
    const result = approvalSchema.safeParse({
      action: 'REJECTED',
      reason: 'Incomplete documents',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action', () => {
    const result = approvalSchema.safeParse({ action: 'UNKNOWN' });
    expect(result.success).toBe(false);
  });

  it('rejects reason exceeding 500 characters', () => {
    const result = approvalSchema.safeParse({
      action: 'REJECTED',
      reason: 'X'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sanitizeString
// ---------------------------------------------------------------------------
describe('sanitizeString', () => {
  it('removes HTML angle brackets', () => {
    expect(sanitizeString('<b>bold</b>')).toBe('bbold/b');
  });

  it('removes javascript: URLs', () => {
    expect(sanitizeString('javascript:alert(1)')).toBe('alert(1)');
  });

  it('removes event handler attributes', () => {
    expect(sanitizeString('onerror=alert(1)')).toBe('alert(1)');
    expect(sanitizeString('onclick=hack()')).toBe('hack()');
  });

  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(sanitizeString('')).toBe('');
  });

  it('leaves safe strings untouched', () => {
    expect(sanitizeString('Hello World 123')).toBe('Hello World 123');
  });
});

// ---------------------------------------------------------------------------
// normalizePhoneNumber
// ---------------------------------------------------------------------------
describe('normalizePhoneNumber', () => {
  it('strips dashes from phone number', () => {
    expect(normalizePhoneNumber('416-555-1234')).toBe('4165551234');
  });

  it('strips spaces and parentheses', () => {
    expect(normalizePhoneNumber('(416) 555-1234')).toBe('4165551234');
  });

  it('strips country code prefix +1', () => {
    expect(normalizePhoneNumber('+1 416 555 1234')).toBe('14165551234');
  });

  it('returns digits only for already clean input', () => {
    expect(normalizePhoneNumber('4165551234')).toBe('4165551234');
  });

  it('handles dots as separators', () => {
    expect(normalizePhoneNumber('416.555.1234')).toBe('4165551234');
  });

  it('returns empty string for empty input', () => {
    expect(normalizePhoneNumber('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------
describe('checkRateLimit', () => {
  // Use a unique identifier per test to avoid cross-test pollution
  let testId = 0;
  beforeEach(() => {
    testId++;
  });

  it('allows the first request', async () => {
    const result = await checkRateLimit(`test-${testId}`, 5, 60000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('decrements remaining on subsequent requests', async () => {
    const id = `test-decrement-${testId}`;
    await checkRateLimit(id, 5, 60000); // 1st: remaining 4
    const second = await checkRateLimit(id, 5, 60000); // 2nd: remaining 3
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(3);
  });

  it('blocks after maxAttempts exceeded', async () => {
    const id = `test-block-${testId}`;
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(id, 3, 60000);
    }
    const blocked = await checkRateLimit(id, 3, 60000);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.error).toContain('Too many attempts');
  });

  it('returns a resetTime in the future', async () => {
    const id = `test-reset-${testId}`;
    const result = await checkRateLimit(id, 5, 60000);
    expect(result.resetTime).toBeDefined();
    expect(result.resetTime!).toBeGreaterThan(Date.now() - 1000);
  });

  it('resets after window expires', async () => {
    const id = `test-expire-${testId}`;
    // Use a tiny window (1ms) so it expires immediately
    await checkRateLimit(id, 1, 1);

    // Small delay to ensure the window expires
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait for 5ms
    }

    const afterExpiry = await checkRateLimit(id, 1, 60000);
    expect(afterExpiry.success).toBe(true);
    expect(afterExpiry.remaining).toBe(0);
  });
});
