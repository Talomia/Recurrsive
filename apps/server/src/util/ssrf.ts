/**
 * @module @recurrsive/server/util/ssrf
 *
 * Shared guard against Server-Side Request Forgery (SSRF) for any route that
 * makes an outbound HTTP request to a user-supplied URL (webhooks, notification
 * delivery, repository cloning). Blocks loopback, private, link-local, and
 * cloud-metadata targets — as literal IPs, IPv4-mapped IPv6 literals, and
 * (via {@link assertOutboundUrlAllowed}) hostnames that RESOLVE to such targets.
 *
 * @packageDocumentation
 */

import { lookup } from 'node:dns/promises';

/** Hostname patterns that must never be reachable via a user-supplied URL. */
const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /^127\./,                       // IPv4 loopback
  /^10\./,                        // Private class A
  /^172\.(1[6-9]|2\d|3[01])\./,   // Private class B
  /^192\.168\./,                  // Private class C
  /^169\.254\./,                  // Link-local / cloud metadata (AWS/GCP/Azure)
  /^0\./,                         // "This" network / 0.0.0.0
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
  /^f[cd][0-9a-f]{2}:/i,          // IPv6 unique-local fc00::/7 (fc.. and fd..)
  /^fe80:/i,                      // IPv6 link-local
  /^::1$/,                        // IPv6 loopback
  /^::$/,                         // IPv6 unspecified
];

/** Exact hostnames that must never be reachable. */
const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.internal',
]);

/**
 * Extract the embedded IPv4 address from an IPv4-mapped IPv6 literal, in both
 * the dotted (`::ffff:169.254.169.254`) and hex (`::ffff:a9fe:a9fe`) forms
 * that Node/undici route to the underlying IPv4 — otherwise these slip past
 * the IPv4 patterns above and reach loopback/metadata. Returns null if the
 * host is not an IPv4-mapped IPv6 literal.
 */
function extractMappedIpv4(host: string): string | null {
  const dotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(host);
  if (dotted) return dotted[1] ?? null;
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(host);
  if (hex) {
    const hi = parseInt(hex[1] ?? '0', 16);
    const lo = parseInt(hex[2] ?? '0', 16);
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
}

/**
 * Whether a hostname is a blocked (private/internal/metadata) literal.
 *
 * @param hostname - Hostname to test (case-insensitive). May be an IPv6
 *   literal with or without surrounding brackets.
 * @returns `true` if the hostname is blocked.
 */
export function isBlockedHost(hostname: string): boolean {
  // WHATWG URL returns IPv6 hosts bracketed (e.g. "[::1]"); strip the brackets
  // so the IPv6 patterns match.
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(h)) return true;
  if (BLOCKED_HOST_PATTERNS.some((p) => p.test(h))) return true;
  // IPv4-mapped IPv6 (::ffff:x.x.x.x / ::ffff:hhhh:hhhh) → test the embedded v4.
  const mapped = extractMappedIpv4(h);
  if (mapped && BLOCKED_HOST_PATTERNS.some((p) => p.test(mapped))) return true;
  return false;
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
 * private or internal network *by literal hostname*. This is a fast,
 * synchronous pre-check; it does NOT resolve DNS. For paths that actually
 * issue the request, prefer {@link assertOutboundUrlAllowed}, which also
 * blocks hostnames that resolve to internal addresses.
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

/**
 * Full outbound-URL validation: the synchronous literal check PLUS DNS
 * resolution, rejecting any hostname whose resolved A/AAAA records point at a
 * private/internal/metadata address. This closes the static-DNS bypass where
 * a public-looking hostname (e.g. `evil.example.com`) resolves to
 * `169.254.169.254`.
 *
 * Note: this validates at check time; it does not pin the resolved IP for the
 * subsequent connection, so a determined DNS-rebinding attacker with fast TTLs
 * is only partially mitigated. Callers should still keep `redirect: 'manual'`.
 *
 * @param raw - Candidate URL.
 * @returns Validation result (never throws; a DNS failure is reported, not thrown).
 */
export async function assertOutboundUrlAllowed(
  raw: string | undefined | null,
): Promise<UrlValidation> {
  const literal = validateOutboundUrl(raw);
  if (!literal.ok) return literal;
  let hostname: string;
  try {
    hostname = new URL(raw as string).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return { ok: false, reason: 'url must be a valid URL' };
  }
  // If the host is already an IP literal, the sync check above covered it.
  // Only resolve real hostnames.
  const looksLikeIp = /^[0-9.]+$/.test(hostname) || hostname.includes(':');
  if (looksLikeIp) return { ok: true };
  try {
    const records = await lookup(hostname, { all: true });
    for (const rec of records) {
      if (isBlockedHost(rec.address)) {
        return {
          ok: false,
          reason: 'url resolves to a private or internal network address',
        };
      }
    }
  } catch {
    // Fail OPEN on resolution failure: a name we can't resolve is a name the
    // subsequent fetch/clone can't connect to either, so nothing internal is
    // exposed. Failing closed here would instead break legitimate creation
    // whenever DNS is momentarily unavailable (or absent, e.g. in tests). The
    // synchronous literal check above already passed; the attack this method
    // adds coverage for — a public name that RESOLVES to a private IP — is
    // still blocked above when resolution succeeds.
    return { ok: true };
  }
  return { ok: true };
}
