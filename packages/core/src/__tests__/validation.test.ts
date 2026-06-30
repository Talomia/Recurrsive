/**
 * Tests for validation utilities: sanitizeInput, validateEmail, validateUrl,
 * truncate, slugify, deepMerge, debounce.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeInput,
  validateEmail,
  validateUrl,
  truncate,
  slugify,
  deepMerge,
  debounce,
} from '../utils/validation.js';

// ---------------------------------------------------------------------------
// sanitizeInput
// ---------------------------------------------------------------------------

describe('sanitizeInput', () => {
  it('strips HTML tags', () => {
    expect(sanitizeInput('<b>bold</b>')).toBe('bold');
  });

  it('strips script tags and their content markers', () => {
    expect(sanitizeInput('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('limits output to 10000 characters', () => {
    const long = 'a'.repeat(20_000);
    expect(sanitizeInput(long).length).toBe(10_000);
  });

  it('handles empty string', () => {
    expect(sanitizeInput('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------

describe('validateEmail', () => {
  it('returns true for valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('returns true for email with subdomain', () => {
    expect(validateEmail('user@mail.example.com')).toBe(true);
  });

  it('returns false for missing @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('returns false for missing domain dot', () => {
    expect(validateEmail('user@localhost')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateEmail('')).toBe(false);
  });

  it('returns false for multiple @', () => {
    expect(validateEmail('user@@example.com')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateUrl
// ---------------------------------------------------------------------------

describe('validateUrl', () => {
  it('returns true for https URL', () => {
    expect(validateUrl('https://example.com')).toBe(true);
  });

  it('returns true for http URL', () => {
    expect(validateUrl('http://example.com')).toBe(true);
  });

  it('returns false for ftp URL', () => {
    expect(validateUrl('ftp://files.net')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(validateUrl('')).toBe(false);
  });

  it('returns false for relative path', () => {
    expect(validateUrl('/path/to/page')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe('truncate', () => {
  it('truncates long strings with default suffix', () => {
    expect(truncate('Hello, World!', 8)).toBe('Hello...');
  });

  it('returns short strings unchanged', () => {
    expect(truncate('Hi', 10)).toBe('Hi');
  });

  it('uses custom suffix', () => {
    expect(truncate('Hello, World!', 8, '…')).toBe('Hello, …');
  });

  it('returns string unchanged when exactly at maxLength', () => {
    expect(truncate('12345', 5)).toBe('12345');
  });
});

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

describe('slugify', () => {
  it('converts spaces to dashes', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips special characters', () => {
    expect(slugify('special@#chars!!')).toBe('specialchars');
  });

  it('lowercases input', () => {
    expect(slugify('UPPER CASE')).toBe('upper-case');
  });

  it('collapses multiple spaces into single dash', () => {
    expect(slugify('  foo  bar  baz  ')).toBe('foo-bar-baz');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// deepMerge
// ---------------------------------------------------------------------------

describe('deepMerge', () => {
  it('merges flat objects', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: 3 });
    expect(result).toEqual({ a: 1, b: 3 });
  });

  it('deeply merges nested objects', () => {
    const result = deepMerge(
      { a: 1, b: { c: 2, d: 3 } },
      { b: { d: 4, e: 5 } },
    );
    expect(result).toEqual({ a: 1, b: { c: 2, d: 4, e: 5 } });
  });

  it('replaces arrays instead of merging', () => {
    const result = deepMerge({ items: [1, 2] }, { items: [3] });
    expect(result).toEqual({ items: [3] });
  });

  it('does not mutate the base object', () => {
    const base = { a: 1, b: { c: 2 } };
    const copy = JSON.parse(JSON.stringify(base));
    deepMerge(base, { b: { c: 99 } });
    expect(base).toEqual(copy);
  });

  it('handles null override values', () => {
    const result = deepMerge({ a: 1, b: 2 }, { b: null } as any);
    expect(result).toEqual({ a: 1, b: null });
  });
});

// ---------------------------------------------------------------------------
// debounce
// ---------------------------------------------------------------------------

describe('debounce', () => {
  it('calls the function after the delay', async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);
    debounced('a');
    expect(fn).not.toHaveBeenCalled();

    await new Promise(resolve => setTimeout(resolve, 80));
    expect(fn).toHaveBeenCalledWith('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('only fires once for multiple rapid calls', async () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);
    debounced('a');
    debounced('b');
    debounced('c');

    await new Promise(resolve => setTimeout(resolve, 80));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });
});
