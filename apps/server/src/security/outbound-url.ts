import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.internal',
]);

const BLOCKED_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

/** Error raised when an outbound destination is unsafe or malformed. */
export class OutboundUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutboundUrlError';
  }
}

function ipv4Parts(address: string): number[] | null {
  const parts = address.split('.').map((part) => Number(part));
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? parts
    : null;
}

/** Return true when an IP address is not suitable as a public outbound target. */
export function isNonPublicIp(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, '').toLowerCase();
  const family = isIP(normalized);

  if (family === 4) {
    const parts = ipv4Parts(normalized);
    if (!parts) return true;
    const [a, b, c] = parts as [number, number, number, number];

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (family === 6) {
    if (normalized === '::' || normalized === '::1') return true;

    // IPv4-mapped IPv6. The WHATWG URL parser canonicalizes the IPv4 suffix
    // into hexadecimal groups, so reconstruct the final 32 bits.
    const mapped = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (mapped) {
      const high = Number.parseInt(mapped[1]!, 16);
      const low = Number.parseInt(mapped[2]!, 16);
      return isNonPublicIp(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
    }

    return (
      /^f[cd]/i.test(normalized) || // Unique-local fc00::/7
      /^fe[89ab]/i.test(normalized) || // Link-local fe80::/10
      /^ff/i.test(normalized) || // Multicast ff00::/8
      /^2001:db8:/i.test(normalized) // Documentation range
    );
  }

  return true;
}

/** Parse a URL and reject unsafe schemes, credentials, names, and literal IPs. */
export function validateOutboundUrl(url: string): URL {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2_048) {
    throw new OutboundUrlError('URL must be a non-empty string of at most 2048 characters.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new OutboundUrlError('URL must be valid.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new OutboundUrlError('URL must use the http or https protocol.');
  }
  if (parsed.username || parsed.password) {
    throw new OutboundUrlError('URL must not contain embedded credentials.');
  }

  if (process.env['RECURRSIVE_ALLOW_PRIVATE_OUTBOUND'] === 'true') return parsed;

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new OutboundUrlError('URL must not point to a private or internal network address.');
  }

  if (isIP(hostname) !== 0 && isNonPublicIp(hostname)) {
    throw new OutboundUrlError('URL must not point to a private or reserved network address.');
  }

  return parsed;
}

/** Resolve a destination and reject hostnames that map to non-public addresses. */
export async function assertSafeOutboundUrl(url: string): Promise<URL> {
  const parsed = validateOutboundUrl(url);
  if (process.env['RECURRSIVE_ALLOW_PRIVATE_OUTBOUND'] === 'true') return parsed;

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(hostname) !== 0) return parsed;

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new OutboundUrlError('URL hostname could not be resolved.');
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isNonPublicIp(address))) {
    throw new OutboundUrlError('URL hostname resolves to a private or reserved network address.');
  }

  return parsed;
}
