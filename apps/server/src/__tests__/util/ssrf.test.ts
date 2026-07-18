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
});
