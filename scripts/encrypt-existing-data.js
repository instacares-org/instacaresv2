/**
 * One-time migration: encrypt existing plaintext sensitive fields in the database.
 *
 * Usage:
 *   FIELD_ENCRYPTION_KEY="<base64-key>" node scripts/encrypt-existing-data.js
 *
 * Or if FIELD_ENCRYPTION_KEY is already in .env / .env.production:
 *   node -e "require('dotenv').config({path:'.env.production'})" && node scripts/encrypt-existing-data.js
 *
 * This script uses a raw PrismaClient (no middleware) to:
 *  1. Read all Child and CheckInOut records
 *  2. Encrypt sensitive fields that are not yet encrypted
 *  3. Write the encrypted values back
 *
 * Safe to run multiple times — skips already-encrypted fields.
 */

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const PREFIX = 'enc:v1:';

// ---- Encryption helpers (standalone, no module import) ----

function getKey() {
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) {
    console.error('ERROR: FIELD_ENCRYPTION_KEY environment variable not set');
    process.exit(1);
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    console.error(`ERROR: Key must be 32 bytes, got ${buf.length}`);
    process.exit(1);
  }
  return buf;
}

function encryptValue(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function isEncrypted(val) {
  return typeof val === 'string' && val.startsWith(PREFIX);
}

// ---- Field definitions (must match field-encryption.ts) ----

const CHILD_FIELDS = [
  { name: 'allergies', type: 'json' },
  { name: 'medications', type: 'json' },
  { name: 'medicalConditions', type: 'json' },
  { name: 'emergencyMedicalInfo', type: 'string' },
  { name: 'bloodType', type: 'string' },
  { name: 'dietaryRestrictions', type: 'json' },
  { name: 'emergencyContacts', type: 'json' },
];

const CHECKINOUT_FIELDS = [
  { name: 'behaviorNotes', type: 'string' },
  { name: 'checkInNotes', type: 'string' },
  { name: 'checkOutNotes', type: 'string' },
];

const USER_PROFILE_FIELDS = [
  { name: 'phone', type: 'string' },
  { name: 'emergencyPhone', type: 'string' },
  { name: 'streetAddress', type: 'string' },
  { name: 'zipCode', type: 'string' },
];

const EMERGENCY_CONTACT_FIELDS = [
  { name: 'phoneNumber', type: 'string' },
  { name: 'email', type: 'string' },
  { name: 'address', type: 'string' },
];

const BABYSITTER_BOOKING_FIELDS = [
  { name: 'address', type: 'string' },
  { name: 'apartment', type: 'string' },
  { name: 'zipCode', type: 'string' },
];

// ---- Main migration ----

async function main() {
  const key = getKey();
  const prisma = new PrismaClient();

  console.log('=== Field-Level Encryption Migration ===\n');

  // --- Encrypt Child records ---
  const children = await prisma.child.findMany();
  console.log(`Found ${children.length} Child records`);

  let childUpdated = 0;
  let childFieldsEncrypted = 0;

  for (const child of children) {
    const updates = {};

    for (const field of CHILD_FIELDS) {
      const val = child[field.name];
      if (val == null) continue;

      // Check if already encrypted
      if (typeof val === 'string' && isEncrypted(val)) continue;

      // Serialize JSON fields, then encrypt
      const plaintext = field.type === 'json' ? JSON.stringify(val) : String(val);
      updates[field.name] = encryptValue(plaintext, key);
      childFieldsEncrypted++;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.$executeRawUnsafe(
        buildUpdateSQL('children', child.id, updates)
      );
      childUpdated++;
    }
  }

  console.log(`  Updated: ${childUpdated} records (${childFieldsEncrypted} fields encrypted)`);

  // --- Encrypt CheckInOut records ---
  const checkIns = await prisma.checkInOut.findMany();
  console.log(`Found ${checkIns.length} CheckInOut records`);

  let checkInUpdated = 0;
  let checkInFieldsEncrypted = 0;

  for (const record of checkIns) {
    const updates = {};

    for (const field of CHECKINOUT_FIELDS) {
      const val = record[field.name];
      if (val == null) continue;
      if (typeof val === 'string' && isEncrypted(val)) continue;

      const plaintext = String(val);
      updates[field.name] = encryptValue(plaintext, key);
      checkInFieldsEncrypted++;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.$executeRawUnsafe(
        buildUpdateSQL('check_in_outs', record.id, updates)
      );
      checkInUpdated++;
    }
  }

  console.log(`  Updated: ${checkInUpdated} records (${checkInFieldsEncrypted} fields encrypted)`);

  // --- Encrypt UserProfile records ---
  const profiles = await prisma.userProfile.findMany();
  console.log(`Found ${profiles.length} UserProfile records`);

  let profileUpdated = 0;
  let profileFieldsEncrypted = 0;

  for (const profile of profiles) {
    const updates = {};
    for (const field of USER_PROFILE_FIELDS) {
      const val = profile[field.name];
      if (val == null) continue;
      if (typeof val === 'string' && isEncrypted(val)) continue;
      updates[field.name] = encryptValue(String(val), key);
      profileFieldsEncrypted++;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.$executeRawUnsafe(buildUpdateSQL('user_profiles', profile.id, updates));
      profileUpdated++;
    }
  }

  console.log(`  Updated: ${profileUpdated} records (${profileFieldsEncrypted} fields encrypted)`);

  // --- Encrypt EmergencyContact records ---
  const contacts = await prisma.emergencyContact.findMany();
  console.log(`Found ${contacts.length} EmergencyContact records`);

  let contactUpdated = 0;
  let contactFieldsEncrypted = 0;

  for (const contact of contacts) {
    const updates = {};
    for (const field of EMERGENCY_CONTACT_FIELDS) {
      const val = contact[field.name];
      if (val == null) continue;
      if (typeof val === 'string' && isEncrypted(val)) continue;
      updates[field.name] = encryptValue(String(val), key);
      contactFieldsEncrypted++;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.$executeRawUnsafe(buildUpdateSQL('emergency_contacts', contact.id, updates));
      contactUpdated++;
    }
  }

  console.log(`  Updated: ${contactUpdated} records (${contactFieldsEncrypted} fields encrypted)`);

  // --- Encrypt BabysitterBooking records ---
  const bsBookings = await prisma.babysitterBooking.findMany();
  console.log(`Found ${bsBookings.length} BabysitterBooking records`);

  let bsBookingUpdated = 0;
  let bsBookingFieldsEncrypted = 0;

  for (const booking of bsBookings) {
    const updates = {};
    for (const field of BABYSITTER_BOOKING_FIELDS) {
      const val = booking[field.name];
      if (val == null) continue;
      if (typeof val === 'string' && isEncrypted(val)) continue;
      updates[field.name] = encryptValue(String(val), key);
      bsBookingFieldsEncrypted++;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.$executeRawUnsafe(buildUpdateSQL('babysitter_bookings', booking.id, updates));
      bsBookingUpdated++;
    }
  }

  console.log(`  Updated: ${bsBookingUpdated} records (${bsBookingFieldsEncrypted} fields encrypted)`);

  const totalRecords = childUpdated + checkInUpdated + profileUpdated + contactUpdated + bsBookingUpdated;
  const totalFields = childFieldsEncrypted + checkInFieldsEncrypted + profileFieldsEncrypted + contactFieldsEncrypted + bsBookingFieldsEncrypted;

  console.log('\n=== Migration complete ===');
  console.log(`Total: ${totalRecords} records updated, ${totalFields} fields encrypted`);

  await prisma.$disconnect();
}

/**
 * Build a raw UPDATE SQL to bypass Prisma's type checking for Json fields.
 * We store encrypted strings directly in JSONB columns (valid as JSON string type).
 */
function buildUpdateSQL(table, id, updates) {
  const setClauses = [];
  const isJsonColumn = new Set([
    'allergies', 'medications', 'medicalConditions',
    'dietaryRestrictions', 'emergencyContacts',
  ]);

  // Map camelCase field names to snake_case column names
  const colMap = {
    // Child fields
    allergies: 'allergies',
    medications: 'medications',
    medicalConditions: '"medicalConditions"',
    emergencyMedicalInfo: '"emergencyMedicalInfo"',
    bloodType: '"bloodType"',
    dietaryRestrictions: '"dietaryRestrictions"',
    emergencyContacts: '"emergencyContacts"',
    // CheckInOut fields
    behaviorNotes: '"behaviorNotes"',
    checkInNotes: '"checkInNotes"',
    checkOutNotes: '"checkOutNotes"',
    // UserProfile fields
    phone: 'phone',
    emergencyPhone: '"emergencyPhone"',
    streetAddress: '"streetAddress"',
    zipCode: '"zipCode"',
    // EmergencyContact fields
    phoneNumber: '"phoneNumber"',
    email: 'email',
    address: 'address',
    // BabysitterBooking fields
    apartment: 'apartment',
  };

  for (const [field, encryptedValue] of Object.entries(updates)) {
    const col = colMap[field] || `"${field}"`;
    // Escape single quotes in the encrypted value
    const escaped = encryptedValue.replace(/'/g, "''");

    if (isJsonColumn.has(field)) {
      // For JSONB columns, cast the encrypted string to jsonb
      setClauses.push(`${col} = '"${escaped}"'::jsonb`);
    } else {
      setClauses.push(`${col} = '${escaped}'`);
    }
  }

  return `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE id = '${id}'`;
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
