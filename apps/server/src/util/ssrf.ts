/**
 * @module @recurrsive/server/util/ssrf
 *
 * Shared guard against Server-Side Request Forgery (SSRF) for any route that
 * makes an outbound HTTP request to a user-supplied URL (webhooks, notification
 * delivery). Blocks loopback, private, link-local, and cloud-metadata targets.
 *
 * @packageDocumentation
 */

/** Hostname patterns that must never be reachable via a user-supplied URL. */
const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /^127\./,                       // IPv4 loopback
  /^10\./,                        // Private class A
  /^172\.(1[6-9]|2\d|3[01])\./,   // Private class B
  /^192\.168\./,                  // Private class C
  /^169\.254\./,                  // Link-local / cloud metadata
  /^0\./,                         // "This" network
  /^fc00:/i,                      // IPv6 unique-local
  /^fe80:/i,                      // IPv6 link-local
  /^::1$/,                        // IPv6 loopback
];

/** Exact hostnames that must never be reachable. */
const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.internal',
]);

/**
 * Whether a hostname resolves to a blocked (private/internal/metadata) target.
 *
 * @param hostname - Hostname to test (case-insensitive).
 * @returns `true` if the hostname is blocked.
 */
export function isBlockedHost(hostname: string): boolean {
  // WHATWG URL returns IPv6 hosts bracketed (e.g. "[::1]"); strip the brackets
  // so the IPv6 patterns match.
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return BLOCKED_HOSTS.has(h) || BLOCKED_HOST_PATTERNS.some((p) => p.test(h));
}

/**
 * Result of validating an outbound URL.
 */
export interface UrlValidation {
  ok: boolean;
  /** Human-readable reason when `ok` is false. */
  reason?: string;
}

/**
 * Validate that a URL is a well-formed http(s) URL that does not target a
 * private or internal network — safe for the server to request outbound.
 *
 * @param raw - Candidate URL.
 * @returns Validation result (never throws).
 */
export function validateOutboundUrl(raw: string | undefined | null): UrlValidation {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, reason: 'url is required' };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'url must be a valid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'url must use http or https' };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, reason: 'url must not point to a private or internal network address' };
  }
  return { ok: true };
}
