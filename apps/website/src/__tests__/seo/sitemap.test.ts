import { describe, it, expect } from 'vitest';
import sitemap from '@/app/sitemap';

describe('Sitemap', () => {
  const entries = sitemap();

  it('returns an array', () => {
    expect(Array.isArray(entries)).toBe(true);
  });

  it('returns a non-empty array of URL entries', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('uses the correct base URL for all entries', () => {
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\/recurrsive\.dev/);
    }
  });

  it('includes the homepage', () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://recurrsive.dev');
  });

  it('includes /product', () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://recurrsive.dev/product');
  });

  it('includes /pricing', () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://recurrsive.dev/pricing');
  });

  it('includes documentation routes', () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://recurrsive.dev/docs');
    expect(urls).toContain('https://recurrsive.dev/docs/getting-started');
    expect(urls).toContain('https://recurrsive.dev/docs/api-reference');
    expect(urls).toContain('https://recurrsive.dev/docs/cli-reference');
  });

  it('includes /about', () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://recurrsive.dev/about');
  });

  it('includes /blog', () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://recurrsive.dev/blog');
  });

  it('includes /cloud', () => {
    const urls = entries.map((e) => e.url);
    expect(urls).toContain('https://recurrsive.dev/cloud');
  });

  it('every entry has a lastModified date', () => {
    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date);
    }
  });

  it('homepage has priority 1.0', () => {
    const homepage = entries.find((e) => e.url === 'https://recurrsive.dev');
    expect(homepage?.priority).toBe(1.0);
  });
});
