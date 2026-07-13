import { afterEach, describe, expect, it } from 'vitest';
import { isNonPublicIp, validateOutboundUrl } from '../security/outbound-url.js';

describe('outbound URL safety', () => {
  afterEach(() => {
    delete process.env['RECURRSIVE_ALLOW_PRIVATE_OUTBOUND'];
  });

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '::1',
    '::ffff:7f00:1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
  ])('rejects non-public IP %s', (address) => {
    expect(isNonPublicIp(address)).toBe(true);
  });

  it.each(['1.1.1.1', '8.8.8.8', '93.184.216.34', '2606:4700:4700::1111'])(
    'accepts public IP %s',
    (address) => {
      expect(isNonPublicIp(address)).toBe(false);
    },
  );

  it.each([
    'http://localhost/hook',
    'http://service.internal/hook',
    'http://169.254.169.254/latest/meta-data',
    'http://2130706433/hook',
    'http://[::ffff:127.0.0.1]/hook',
    'ftp://example.com/hook',
    'https://user:password@example.com/hook',
  ])('rejects unsafe URL %s', (url) => {
    expect(() => validateOutboundUrl(url)).toThrow();
  });

  it('accepts a public HTTPS destination', () => {
    expect(validateOutboundUrl('https://example.com/hook').hostname).toBe('example.com');
  });

  it('only permits private destinations behind an explicit opt-in', () => {
    process.env['RECURRSIVE_ALLOW_PRIVATE_OUTBOUND'] = 'true';
    expect(validateOutboundUrl('http://localhost/hook').hostname).toBe('localhost');
  });
});
