import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the encryption functions directly, so import without the global mocks
// that our setup.ts applies (those mock the db, not crypto)
const originalEnv = process.env.FIELD_ENCRYPTION_KEY;

describe('field-encryption', () => {
  // Use a known test key (32 bytes, base64-encoded)
  const TEST_KEY = Buffer.from('a]Fx9Y$mQ!2kLp@wR#eT^uI&oP*sD(fG', 'utf8').subarray(0, 32).toString('base64');

  beforeEach(() => {
    vi.resetModules();
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.FIELD_ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.FIELD_ENCRYPTION_KEY;
    }
  });

  it('encrypts a string field and produces enc:v1: prefix', async () => {
    const { encryptField } = await import('@/lib/field-encryption');
    const encrypted = encryptField('555-1234');
    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain('555-1234');
  });

  it('decrypts back to the original value', async () => {
    const { encryptField, decryptField } = await import('@/lib/field-encryption');
    const original = 'My secret address 123';
    const encrypted = encryptField(original);
    const decrypted = decryptField(encrypted);
    expect(decrypted).toBe(original);
  });

  it('handles unicode and special characters', async () => {
    const { encryptField, decryptField } = await import('@/lib/field-encryption');
    const original = 'Rue Saint-André #42, Montréal 日本語';
    const decrypted = decryptField(encryptField(original));
    expect(decrypted).toBe(original);
  });

  it('isEncrypted detects encrypted values', async () => {
    const { encryptField, isEncrypted } = await import('@/lib/field-encryption');
    expect(isEncrypted('enc:v1:abc:def:ghi')).toBe(true);
    expect(isEncrypted('plain text')).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(123)).toBe(false);
    expect(isEncrypted(encryptField('test'))).toBe(true);
  });

  it('decryptField passes through non-encrypted values unchanged', async () => {
    const { decryptField } = await import('@/lib/field-encryption');
    expect(decryptField('plain text')).toBe('plain text');
    expect(decryptField('')).toBe('');
  });

  it('each encryption produces different ciphertext (random IV)', async () => {
    const { encryptField } = await import('@/lib/field-encryption');
    const a = encryptField('same input');
    const b = encryptField('same input');
    expect(a).not.toBe(b); // Different IVs
  });

  it('returns plaintext when FIELD_ENCRYPTION_KEY is not set', async () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    vi.resetModules();
    const { encryptField } = await import('@/lib/field-encryption');
    const result = encryptField('my secret');
    expect(result).toBe('my secret');
  });

  it('rejects key with wrong length', async () => {
    process.env.FIELD_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
    vi.resetModules();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { encryptField } = await import('@/lib/field-encryption');
    const result = encryptField('my secret');
    expect(result).toBe('my secret'); // Falls back to plaintext
    consoleSpy.mockRestore();
  });
});
