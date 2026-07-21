import { describe, it, expect } from 'vitest';
import { validateOutboundUrl, isBlockedHost } from '../../util/ssrf.js';

describe('SSRF guard', () => {
  it('allows public https/http URLs', () => {
    expect(validateOutboundUrl('https://hooks.slack.com/services/x').ok).toBe(true);
    expect(validateOutboundUrl('http://example.com/webhook').ok).toBe(true);
  });

  it('blocks private / internal / metadata targets', () => {
    for (const u of [
      'http://127.0.0.1/x', 'http://localhost/x', 'http://10.0.0.5/x',
      'http://192.168.1.1/x', 'http://172.16.0.1/x', 'http://169.254.169.254/latest/meta-data',
      'http://metadata.google.internal/x', 'http://[::1]/x',
    ]) {
      expect(validateOutboundUrl(u).ok, `${u} should be blocked`).toBe(false);
    }
  });

  it('rejects non-http protocols and malformed URLs', () => {
    expect(validateOutboundUrl('file:///etc/passwd').ok).toBe(false);
    expect(validateOutboundUrl('gopher://x').ok).toBe(false);
    expect(validateOutboundUrl('not a url').ok).toBe(false);
    expect(validateOutboundUrl(undefined).ok).toBe(false);
  });

  it('isBlockedHost matches known internal hosts', () => {
    expect(isBlockedHost('169.254.169.254')).toBe(true);
    expect(isBlockedHost('example.com')).toBe(false);
  });

  it('blocks IPv4-mapped IPv6 literals that Node routes to the underlying IPv4', () => {
    // Regression: these slipped past the IPv4 patterns and reached
    // loopback/metadata (Node/undici routes ::ffff:x.x.x.x to the IPv4).
    for (const u of [
      'http://[::ffff:169.254.169.254]/latest/meta-data', // dotted form
      'http://[::ffff:127.0.0.1]/x',
      'http://[::ffff:a9fe:a9fe]/x',                       // hex form of 169.254.169.254
      'http://[::ffff:7f00:1]/x',                          // hex form of 127.0.0.1
    ]) {
      expect(validateOutboundUrl(u).ok, `${u} should be blocked`).toBe(false);
    }
    // A public IPv4-mapped address is still allowed.
    expect(isBlockedHost('::ffff:93.184.216.34')).toBe(false);
  });

  it('blocks the fd00::/8 unique-local range (not just fc00)', () => {
    expect(isBlockedHost('fd12:3456::1')).toBe(true);
    expect(isBlockedHost('fc00::1')).toBe(true);
  });
});
