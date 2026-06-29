import { describe, it, expect } from 'vitest';
import { generateId, isValidId, qualifiedName } from '../../utils/id.js';

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------
describe('generateId', () => {
  it('returns a string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
  });

  it('returns a non-empty string', () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns a valid UUID v4 format (8-4-4-4-12 hex groups)', () => {
    const id = generateId();
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidV4Regex);
  });

  it('returns unique values on repeated calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('is recognized as valid by isValidId', () => {
    const id = generateId();
    expect(isValidId(id)).toBe(true);
  });

  it('returns exactly 36 characters (UUID canonical form)', () => {
    const id = generateId();
    expect(id.length).toBe(36);
  });
});

// ---------------------------------------------------------------------------
// isValidId
// ---------------------------------------------------------------------------
describe('isValidId', () => {
  it('returns true for a valid UUID v4', () => {
    expect(isValidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('returns true for a generated UUID', () => {
    expect(isValidId(generateId())).toBe(true);
  });

  it('returns false for an empty string', () => {
    expect(isValidId('')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isValidId('not-a-uuid')).toBe(false);
  });

  it('returns false for a string with wrong length', () => {
    expect(isValidId('550e8400-e29b-41d4-a716')).toBe(false);
  });

  it('returns false for a UUID with invalid characters', () => {
    expect(isValidId('550e8400-e29b-41d4-a716-44665544gggg')).toBe(false);
  });

  it('returns false for a UUID without dashes', () => {
    expect(isValidId('550e8400e29b41d4a716446655440000')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// qualifiedName
// ---------------------------------------------------------------------------
describe('qualifiedName', () => {
  it('joins a single segment', () => {
    expect(qualifiedName('repo')).toBe('repo');
  });

  it('joins two segments with a colon', () => {
    expect(qualifiedName('repo', 'file')).toBe('repo:file');
  });

  it('joins multiple segments with colons', () => {
    expect(qualifiedName('my-repo', 'src/index.ts', 'MyClass', 'myMethod')).toBe(
      'my-repo:src/index.ts:MyClass:myMethod',
    );
  });

  it('filters out empty string segments', () => {
    expect(qualifiedName('a', '', 'c')).toBe('a:c');
  });

  it('throws when called with no segments', () => {
    expect(() => qualifiedName()).toThrow('qualifiedName requires at least one non-empty segment');
  });

  it('throws an Error instance when no segments provided', () => {
    expect(() => qualifiedName()).toThrow(Error);
  });

  it('handles segments containing colons', () => {
    expect(qualifiedName('a:b', 'c')).toBe('a:b:c');
  });

  it('handles segments with special characters', () => {
    expect(qualifiedName('repo', 'path/to/file.ts', '[index]')).toBe(
      'repo:path/to/file.ts:[index]',
    );
  });
});
