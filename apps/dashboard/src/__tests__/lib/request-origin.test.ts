import { describe, expect, it } from 'vitest';
import { isTrustedMutationOrigin } from '@/lib/request-origin';

describe('isTrustedMutationOrigin', () => {
  it('accepts same-origin browser mutations', () => {
    expect(isTrustedMutationOrigin('https://dashboard.example.com', 'https://dashboard.example.com')).toBe(true);
  });

  it('rejects cross-origin requests even when proxy headers could be spoofed elsewhere', () => {
    expect(isTrustedMutationOrigin('https://attacker.example', 'https://dashboard.example.com')).toBe(false);
  });

  it('uses the configured public origin behind a reverse proxy', () => {
    expect(isTrustedMutationOrigin(
      'https://dashboard.example.com',
      'http://dashboard:3100',
      'https://dashboard.example.com',
    )).toBe(true);
  });

  it('allows non-browser clients that omit Origin', () => {
    expect(isTrustedMutationOrigin(null, 'https://dashboard.example.com')).toBe(true);
  });
});
