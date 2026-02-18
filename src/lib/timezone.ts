/**
 * Timezone Utility Library
 * Handles all timezone conversions consistently across the application
 */

import { DateTime } from 'luxon';

// Common timezones for the platform
export const COMMON_TIMEZONES = {
  // Canada
  'America/Toronto': 'Eastern Time (Toronto)',
  'America/Vancouver': 'Pacific Time (Vancouver)',
  'America/Edmonton': 'Mountain Time (Edmonton)',
  'America/Halifax': 'Atlantic Time (Halifax)',
  'America/Winnipeg': 'Central Time (Winnipeg)',

  // United States
  'America/New_York': 'Eastern Time (New York)',
  'America/Chicago': 'Central Time (Chicago)',
  'America/Denver': 'Mountain Time (Denver)',
  'America/Los_Angeles': 'Pacific Time (Los Angeles)',

  // UK
  'Europe/London': 'British Time (London)',
} as const;

// Default timezone fallback
export const DEFAULT_TIMEZONE = 'America/Toronto';

// Province/state name normalization to 2-letter codes
const PROVINCE_NAME_TO_CODE: { [key: string]: string } = {
  // Canadian provinces - full names to codes
  'ontario': 'ON',
  'quebec': 'QC',
  'british columbia': 'BC',
  'alberta': 'AB',
  'manitoba': 'MB',
  'saskatchewan': 'SK',
  'nova scotia': 'NS',
  'new brunswick': 'NB',
  'newfoundland and labrador': 'NL',
  'newfoundland': 'NL',
  'prince edward island': 'PE',
  'northwest territories': 'NT',
  'nunavut': 'NU',
  'yukon': 'YT',
};

/**
 * Normalize province/state to 2-letter code
 * Handles both full names ("Ontario") and codes ("ON")
 */
function normalizeStateCode(state?: string): string | undefined {
  if (!state) return undefined;
  const normalized = state.toLowerCase().trim();
  // Check if it's a full name that needs conversion
  if (PROVINCE_NAME_TO_CODE[normalized]) {
    return PROVINCE_NAME_TO_CODE[normalized];
  }
  // Already a code or unknown - return uppercase
  return state.toUpperCase().trim();
}

/**
 * Get timezone from country and state/province
 * Accepts both 2-letter codes (ON, BC) and full names (Ontario, British Columbia)
 */
export function getTimezoneFromLocation(country: string, state?: string): string {
  // Normalize the state to a 2-letter code
  const normalizedState = normalizeStateCode(state);

  if (country === 'CA' || country === 'Canada') {
    switch (normalizedState) {
      case 'ON': return 'America/Toronto';
      case 'BC': return 'America/Vancouver';
      case 'AB': return 'America/Edmonton';
      case 'NS': case 'NB': case 'PE': case 'NL': return 'America/Halifax';
      case 'MB': return 'America/Winnipeg';
      case 'SK': return 'America/Regina';
      case 'QC': return 'America/Toronto'; // Quebec uses Eastern time
      case 'NT': case 'NU': return 'America/Edmonton'; // Northern territories
      case 'YT': return 'America/Vancouver'; // Yukon uses Pacific
      default: return 'America/Toronto';
    }
  }

  if (country === 'US') {
    switch (normalizedState) {
      case 'NY': case 'FL': case 'GA': case 'NC': case 'VA':
        return 'America/New_York';
      case 'IL': case 'TX': case 'MO': case 'MN':
        return 'America/Chicago';
      case 'CO': case 'AZ': case 'UT':
        return 'America/Denver';
      case 'CA': case 'WA': case 'OR': case 'NV':
        return 'America/Los_Angeles';
      default: return 'America/New_York';
    }
  }

  if (country === 'GB' || country === 'UK') {
    return 'Europe/London';
  }

  return DEFAULT_TIMEZONE;
}

/**
 * Convert user's local time to UTC for database storage
 */
export function convertToUTC(localTimeString: string, userTimezone: string): DateTime {
  const dt = DateTime.fromISO(localTimeString, { zone: userTimezone });

  if (!dt.isValid) {
    throw new Error(`Invalid date/time: ${localTimeString} in timezone ${userTimezone}`);
  }

  return dt.toUTC();
}

/**
 * Convert UTC time to user's local timezone for display
 */
export function convertFromUTC(utcTime: Date | string, userTimezone: string): DateTime {
  const dt = typeof utcTime === 'string'
    ? DateTime.fromISO(utcTime, { zone: 'UTC' })
    : DateTime.fromJSDate(utcTime, { zone: 'UTC' });

  if (!dt.isValid) {
    throw new Error(`Invalid UTC time: ${utcTime}`);
  }

  return dt.setZone(userTimezone);
}

/**
 * Format time for display with timezone abbreviation
 */
export function formatTimeWithZone(
  utcTime: Date | string,
  userTimezone: string,
  format: 'short' | 'long' = 'short'
): string {
  const dt = convertFromUTC(utcTime, userTimezone);

  if (format === 'short') {
    return dt.toFormat('h:mm a ZZZZ');
  } else {
    return dt.toFormat('h:mm a zzzz');
  }
}

/**
 * Format date and time for display
 */
export function formatDateTimeWithZone(
  utcTime: Date | string,
  userTimezone: string
): string {
  const dt = convertFromUTC(utcTime, userTimezone);
  return dt.toFormat('MMM d, yyyy, h:mm a ZZZZ');
}

/**
 * Get timezone abbreviation
 */
export function getTimezoneAbbreviation(
  timezone: string,
  date: Date = new Date()
): string {
  const dt = DateTime.fromJSDate(date, { zone: timezone });
  return dt.toFormat('ZZZZ');
}

/**
 * Get timezone offset in hours
 */
export function getTimezoneOffset(
  timezone: string,
  date: Date = new Date()
): number {
  const dt = DateTime.fromJSDate(date, { zone: timezone });
  return dt.offset / 60;
}

/**
 * Validate timezone string
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    const dt = DateTime.local().setZone(timezone);
    return dt.isValid;
  } catch {
    return false;
  }
}

/**
 * Get user-friendly timezone name
 */
export function getTimezoneName(timezone: string): string {
  return COMMON_TIMEZONES[timezone as keyof typeof COMMON_TIMEZONES] || timezone;
}

/**
 * Create a combined date-time string in user's timezone
 */
export function combineDateTime(
  dateString: string,
  timeString: string,
  userTimezone: string
): string {
  // Handle both formats:
  // 1. timeString = "07:00" (time only)
  // 2. timeString = "2025-11-10T07:00:00" (full datetime)

  let dt: DateTime;

  if (timeString.includes('T')) {
    // Full datetime string provided - use it directly
    dt = DateTime.fromISO(timeString, { zone: userTimezone });
  } else {
    // Time-only string - combine with date
    const combined = `${dateString}T${timeString}:00`;
    dt = DateTime.fromISO(combined, { zone: userTimezone });
  }

  if (!dt.isValid) {
    throw new Error(`Invalid date/time: dateString="${dateString}", timeString="${timeString}"`);
  }

  return dt.toUTC().toISO()!;
}

/**
 * Get current time in a specific timezone
 */
export function nowInTimezone(timezone: string): DateTime {
  return DateTime.now().setZone(timezone);
}

/**
 * Get start of day in user's timezone
 */
export function startOfDayInTimezone(date: Date | string, timezone: string): DateTime {
  const dt = typeof date === 'string'
    ? DateTime.fromISO(date, { zone: timezone })
    : DateTime.fromJSDate(date, { zone: timezone });

  return dt.startOf('day').toUTC();
}

/**
 * Get end of day in user's timezone
 */
export function endOfDayInTimezone(date: Date | string, timezone: string): DateTime {
  const dt = typeof date === 'string'
    ? DateTime.fromISO(date, { zone: timezone })
    : DateTime.fromJSDate(date, { zone: timezone });

  return dt.endOf('day').toUTC();
}
