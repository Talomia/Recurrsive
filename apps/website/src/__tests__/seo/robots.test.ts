import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';

describe('Robots', () => {
  const config = robots();

  it('returns an object with rules', () => {
    expect(config).toHaveProperty('rules');
  });

  it('rules is an array with at least one entry', () => {
    expect(Array.isArray(config.rules)).toBe(true);
    const rules = config.rules as Array<{ userAgent: string; allow: string; disallow: string }>;
    expect(rules.length).toBeGreaterThan(0);
  });

  it('first rule targets all user agents', () => {
    const rules = config.rules as Array<{ userAgent: string }>;
    expect(rules[0].userAgent).toBe('*');
  });

  it('first rule allows /', () => {
    const rules = config.rules as Array<{ allow: string }>;
    expect(rules[0].allow).toBe('/');
  });

  it('first rule disallows /api/', () => {
    const rules = config.rules as Array<{ disallow: string }>;
    expect(rules[0].disallow).toBe('/api/');
  });

  it('includes the sitemap URL', () => {
    expect(config.sitemap).toBe('https://recurrsive.dev/sitemap.xml');
  });
});
