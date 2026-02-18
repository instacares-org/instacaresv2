import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

// ============================================================
// AES-256-GCM Field-Level Encryption for Sensitive Data
// ============================================================
//
// Transparently encrypts/decrypts sensitive fields (medical info,
// PII) via Prisma client extension. Data is encrypted at rest in
// the DB and decrypted only in application memory.
//
// Encrypted format: enc:v1:<base64-iv>:<base64-authTag>:<base64-ciphertext>
// The "v1" version tag supports future key rotation.
// ============================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const PREFIX = 'enc:v1:';

// ---- Field configuration per Prisma model ----

interface FieldConfig {
  name: string;
  type: 'string' | 'json';
}

const CHILD_FIELDS: FieldConfig[] = [
  { name: 'allergies', type: 'json' },
  { name: 'medications', type: 'json' },
  { name: 'medicalConditions', type: 'json' },
  { name: 'emergencyMedicalInfo', type: 'string' },
  { name: 'bloodType', type: 'string' },
  { name: 'dietaryRestrictions', type: 'json' },
  { name: 'emergencyContacts', type: 'json' },
];

const CHECKINOUT_FIELDS: FieldConfig[] = [
  { name: 'behaviorNotes', type: 'string' },
  { name: 'checkInNotes', type: 'string' },
  { name: 'checkOutNotes', type: 'string' },
];

const USER_PROFILE_FIELDS: FieldConfig[] = [
  { name: 'phone', type: 'string' },
  { name: 'emergencyPhone', type: 'string' },
  { name: 'streetAddress', type: 'string' },
  { name: 'zipCode', type: 'string' },
];

const EMERGENCY_CONTACT_FIELDS: FieldConfig[] = [
  { name: 'phoneNumber', type: 'string' },
  { name: 'email', type: 'string' },
  { name: 'address', type: 'string' },
];

const BABYSITTER_BOOKING_FIELDS: FieldConfig[] = [
  { name: 'address', type: 'string' },
  { name: 'apartment', type: 'string' },
  { name: 'zipCode', type: 'string' },
];

// ---- Key management ----

let encryptionKey: Buffer | null = null;
let keyChecked = false;

function getKey(): Buffer | null {
  if (keyChecked) return encryptionKey;
  keyChecked = true;

  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    console.warn('FIELD_ENCRYPTION_KEY not set — sensitive fields stored in plaintext');
    return null;
  }

  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    console.error('FIELD_ENCRYPTION_KEY must be exactly 32 bytes (256 bits), base64-encoded. Got', buf.length, 'bytes');
    return null;
  }

  encryptionKey = buf;
  return encryptionKey;
}

// ---- Core encrypt / decrypt ----

export function encryptField(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptField(ciphertext: string): string {
  if (!isEncrypted(ciphertext)) return ciphertext;

  const key = getKey();
  if (!key) return ciphertext;

  try {
    const parts = ciphertext.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return ciphertext;

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const encrypted = Buffer.from(parts[2], 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
  } catch (err) {
    console.error('Field decryption failed — returning raw value:', err);
    return ciphertext;
  }
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

// ---- Object-level helpers ----

function encryptObjectFields(data: Record<string, unknown>, fields: FieldConfig[]): void {
  if (!data || typeof data !== 'object' || !getKey()) return;

  for (const field of fields) {
    if (field.name in data && data[field.name] != null) {
      const val = data[field.name];
      if (typeof val === 'string' && isEncrypted(val)) continue;
      const plaintext = field.type === 'json' ? JSON.stringify(val) : String(val);
      data[field.name] = encryptField(plaintext);
    }
  }
}

function decryptObjectFields(obj: Record<string, unknown>, fields: FieldConfig[]): void {
  if (!obj || typeof obj !== 'object') return;

  for (const field of fields) {
    if (field.name in obj && obj[field.name] != null) {
      const val = obj[field.name];
      if (typeof val === 'string' && isEncrypted(val)) {
        const decrypted = decryptField(val);
        obj[field.name] = field.type === 'json' ? JSON.parse(decrypted) : decrypted;
      }
    }
  }
}

function decryptResult(result: unknown, fields: FieldConfig[]): void {
  if (result == null) return;
  if (Array.isArray(result)) {
    for (const item of result) decryptObjectFields(item as Record<string, unknown>, fields);
  } else if (typeof result === 'object') {
    decryptObjectFields(result as Record<string, unknown>, fields);
  }
}

// ---- Prisma $extends query interceptor ----

const WRITE_OPS = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany']);
const READ_OPS = new Set(['findUnique', 'findFirst', 'findMany', 'create', 'update', 'upsert', 'delete']);

function createModelInterceptor(fields: FieldConfig[]) {
  return {
    async $allOperations({ operation, args, query }: { operation: string; args: Record<string, unknown>; query: (args: Record<string, unknown>) => Promise<unknown> }) {
      // Encrypt before writing
      if (WRITE_OPS.has(operation)) {
        if (operation === 'upsert') {
          if (args.create) encryptObjectFields(args.create as Record<string, unknown>, fields);
          if (args.update) encryptObjectFields(args.update as Record<string, unknown>, fields);
        } else if (operation === 'createMany' && Array.isArray(args?.data)) {
          for (const item of args.data) encryptObjectFields(item as Record<string, unknown>, fields);
        } else if (args?.data) {
          encryptObjectFields(args.data as Record<string, unknown>, fields);
        }
      }

      const result = await query(args);

      // Decrypt after reading
      if (READ_OPS.has(operation)) {
        decryptResult(result, fields);
      }

      return result;
    },
  };
}

/**
 * Apply field-level encryption to a PrismaClient via $extends.
 * Returns an extended client that transparently encrypts/decrypts
 * sensitive fields on Child and CheckInOut models.
 */
export function applyFieldEncryption(client: PrismaClient) {
  return client.$extends({
    query: {
      child: createModelInterceptor(CHILD_FIELDS),
      checkInOut: createModelInterceptor(CHECKINOUT_FIELDS),
      userProfile: createModelInterceptor(USER_PROFILE_FIELDS),
      emergencyContact: createModelInterceptor(EMERGENCY_CONTACT_FIELDS),
      babysitterBooking: createModelInterceptor(BABYSITTER_BOOKING_FIELDS),
    },
  });
}
