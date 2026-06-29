/**
 * ISO-8601 datetime utility functions.
 *
 * All functions produce strings compatible with Zod's
 * `z.string().datetime()` validation.
 *
 * @module
 */

/**
 * Return the current time as an ISO-8601 string with millisecond
 * precision and UTC timezone.
 *
 * @returns ISO-8601 datetime string (e.g. `'2024-01-15T09:30:00.000Z'`).
 *
 * @example
 * ```ts
 * const now = nowISO();
 * // '2024-01-15T09:30:00.123Z'
 * ```
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Convert a `Date` object to an ISO-8601 string.
 *
 * @param date - The Date to convert.
 * @returns ISO-8601 datetime string.
 *
 * @example
 * ```ts
 * toISO(new Date(2024, 0, 15));
 * // '2024-01-15T00:00:00.000Z'
 * ```
 */
export function toISO(date: Date): string {
  return date.toISOString();
}

/**
 * Parse an ISO-8601 string into a `Date` object.
 *
 * @param iso - ISO-8601 datetime string.
 * @returns Parsed `Date`.
 * @throws {Error} If the string is not a valid date.
 *
 * @example
 * ```ts
 * const d = fromISO('2024-01-15T09:30:00.000Z');
 * d.getFullYear(); // 2024
 * ```
 */
export function fromISO(iso: string): Date {
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO-8601 datetime string: "${iso}"`);
  }
  return date;
}

/**
 * Calculate the elapsed duration in milliseconds between two
 * ISO-8601 timestamps.
 *
 * @param start - ISO-8601 start timestamp.
 * @param end - ISO-8601 end timestamp (defaults to now).
 * @returns Duration in milliseconds.
 * @throws {Error} If either timestamp is invalid.
 *
 * @example
 * ```ts
 * const ms = durationMs('2024-01-15T09:00:00.000Z', '2024-01-15T09:01:00.000Z');
 * // 60000
 * ```
 */
export function durationMs(start: string, end?: string): number {
  const startDate = fromISO(start);
  const endDate = end ? fromISO(end) : new Date();
  const duration = endDate.getTime() - startDate.getTime();
  return Math.max(0, duration);
}

/**
 * Format a duration in milliseconds as a human-readable string.
 *
 * @param ms - Duration in milliseconds.
 * @returns Human-readable string (e.g. `'2m 30s'`, `'1h 15m'`).
 *
 * @example
 * ```ts
 * formatDuration(150000); // '2m 30s'
 * formatDuration(500);    // '500ms'
 * ```
 */
export function formatDuration(ms: number): string {
  const abs = Math.max(0, Math.round(ms));
  if (abs < 1000) {
    return `${abs}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

/**
 * Check whether an ISO-8601 timestamp is older than a given number
 * of days from now.
 *
 * @param iso - ISO-8601 datetime string.
 * @param days - Number of days threshold.
 * @returns `true` if the timestamp is older than `days` days.
 *
 * @example
 * ```ts
 * isOlderThan('2020-01-01T00:00:00.000Z', 30); // true
 * ```
 */
export function isOlderThan(iso: string, days: number): boolean {
  const date = fromISO(iso);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return date.getTime() < threshold.getTime();
}
