import { describe, expect, it } from 'vitest';
import { mustOmitResponseBody } from '@/lib/proxy-response';

describe('mustOmitResponseBody', () => {
  it('omits bodies for HEAD and bodyless response status codes', () => {
    expect(mustOmitResponseBody('HEAD', 200)).toBe(true);
    expect(mustOmitResponseBody('DELETE', 204)).toBe(true);
    expect(mustOmitResponseBody('POST', 205)).toBe(true);
    expect(mustOmitResponseBody('GET', 304)).toBe(true);
  });

  it('preserves normal response bodies', () => {
    expect(mustOmitResponseBody('GET', 200)).toBe(false);
    expect(mustOmitResponseBody('DELETE', 200)).toBe(false);
  });
});
