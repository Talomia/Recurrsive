/**
 * @module @recurrsive/core/utils/validation
 *
 * String validation, sanitization, and general-purpose utility functions.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed input length for sanitizeInput. */
const MAX_INPUT_LENGTH = 10_000;

/** Default truncation suffix. */
const DEFAULT_SUFFIX = '...';

// ---------------------------------------------------------------------------
// Sanitization
// ---------------------------------------------------------------------------

/**
 * Strip dangerous characters, trim whitespace, and limit length.
 *
 * Removes HTML/script tags and trims the result. Output is capped at
 * {@link MAX_INPUT_LENGTH} characters.
 *
 * ```ts
 * sanitizeInput('  <script>alert("xss")</script>Hello  '); // 'Hello'
 * ```
 *
 * @param input - Raw user input string.
 * @returns Sanitized string.
 */
export function sanitizeInput(input: string): string {
  const stripped = input.replace(/<[^>]*>/g, '');
  const trimmed = stripped.trim();
  return trimmed.slice(0, MAX_INPUT_LENGTH);
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

/**
 * Basic email format validation.
 *
 * Checks that the string contains `@` with content on both sides and
 * a `.` in the domain portion.
 *
 * ```ts
 * validateEmail('user@example.com'); // true
 * validateEmail('not-an-email');     // false
 * ```
 *
 * @param email - String to validate.
 * @returns `true` if the string looks like a valid email address.
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const parts = email.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  return domain.includes('.');
}

/**
 * Validate that a string is a well-formed HTTP(S) URL.
 *
 * ```ts
 * validateUrl('https://example.com'); // true
 * validateUrl('ftp://files.net');     // false
 * ```
 *
 * @param url - String to validate.
 * @returns `true` if the string starts with `http://` or `https://`.
 */
export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

// ---------------------------------------------------------------------------
// String Utilities
// ---------------------------------------------------------------------------

/**
 * Truncate a string to a maximum length, appending a suffix when truncated.
 *
 * If the string is already within `maxLength`, it is returned unchanged.
 *
 * ```ts
 * truncate('Hello, World!', 8);           // 'Hello...'
 * truncate('Hi', 10);                     // 'Hi'
 * truncate('Hello, World!', 8, '…');      // 'Hello, …'
 * ```
 *
 * @param str - The string to truncate.
 * @param maxLength - Maximum allowed length (including suffix).
 * @param suffix - Suffix appended when truncated (default `'...'`).
 * @returns The (possibly truncated) string.
 */
export function truncate(str: string, maxLength: number, suffix: string = DEFAULT_SUFFIX): string {
  if (str.length <= maxLength) return str;
  if (maxLength <= suffix.length) return str.slice(0, maxLength);
  return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Convert a string to a URL-safe slug.
 *
 * Lowercases, replaces whitespace runs with a single dash, strips
 * non-alphanumeric characters (except dashes), and trims leading/trailing
 * dashes.
 *
 * ```ts
 * slugify('Hello World!');          // 'hello-world'
 * slugify('  Foo  Bar  Baz  ');     // 'foo-bar-baz'
 * slugify('special@#chars!!');      // 'specialchars'
 * ```
 *
 * @param input - The string to slugify.
 * @returns URL-safe slug.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Object Utilities
// ---------------------------------------------------------------------------

/**
 * Recursively deep-merge two objects. Arrays and non-plain-object values
 * in `override` replace the corresponding value in `base`. The merge is
 * non-mutating — a new object is returned.
 *
 * ```ts
 * const merged = deepMerge({ a: 1, b: { c: 2 } }, { b: { d: 3 } });
 * // { a: 1, b: { c: 2, d: 3 } }
 * ```
 *
 * @param base - The base object.
 * @param override - Partial overrides.
 * @returns A new deeply-merged object.
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const result = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overrideVal = (override as Record<string, unknown>)[key];

    if (
      overrideVal !== null &&
      overrideVal !== undefined &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      baseVal !== null &&
      baseVal !== undefined &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Record<string, unknown>,
      );
    } else {
      result[key] = overrideVal;
    }
  }

  return result as T;
}

// ---------------------------------------------------------------------------
// Function Utilities
// ---------------------------------------------------------------------------

/**
 * Create a debounced version of a function that delays invocation until
 * `ms` milliseconds have elapsed since the last call.
 *
 * ```ts
 * const debouncedLog = debounce(console.log, 300);
 * debouncedLog('a');
 * debouncedLog('b'); // only 'b' is logged after 300ms
 * ```
 *
 * @param fn - The function to debounce.
 * @param ms - Delay in milliseconds.
 * @returns A debounced wrapper with the same signature.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): T {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = (...args: unknown[]) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };

  return debounced as unknown as T;
}
