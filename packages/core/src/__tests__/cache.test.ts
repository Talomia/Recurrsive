/**
 * Tests for LRUCache utility.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LRUCache } from '../utils/cache.js';

// ---------------------------------------------------------------------------
// LRUCache
// ---------------------------------------------------------------------------

describe('LRUCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
  });

  it('evicts oldest when full', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3); // should evict 'a'
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
  });

  it('get() refreshes access order', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // refresh 'a', so 'b' is now oldest
    cache.set('c', 3); // should evict 'b'
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('TTL expires entries', () => {
    const cache = new LRUCache<string, number>(10, 1000);
    cache.set('a', 1);

    // Before TTL
    expect(cache.get('a')).toBe(1);

    // Advance past TTL
    vi.advanceTimersByTime(1500);
    expect(cache.get('a')).toBeUndefined();
  });

  it('has() checks existence', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('x', 42);
    expect(cache.has('x')).toBe(true);
    expect(cache.has('y')).toBe(false);
  });

  it('delete() removes entries', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('a', 1);
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.delete('a')).toBe(false);
  });

  it('clear() empties cache', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });

  it('size reflects current count', () => {
    const cache = new LRUCache<string, number>(10);
    expect(cache.size).toBe(0);
    cache.set('a', 1);
    expect(cache.size).toBe(1);
    cache.set('b', 2);
    expect(cache.size).toBe(2);
    cache.delete('a');
    expect(cache.size).toBe(1);
  });

  it('entries() returns all items', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    const entries = cache.entries();
    expect(entries).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
  });

  it('handles zero-size cache edge case', () => {
    const cache = new LRUCache<string, number>(0);
    cache.set('a', 1);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
    expect(cache.entries()).toEqual([]);
  });

  it('handles string keys', () => {
    const cache = new LRUCache<string, string>(5);
    cache.set('hello', 'world');
    cache.set('foo', 'bar');
    expect(cache.get('hello')).toBe('world');
    expect(cache.get('foo')).toBe('bar');
  });

  it('handles number keys', () => {
    const cache = new LRUCache<number, string>(5);
    cache.set(1, 'one');
    cache.set(2, 'two');
    expect(cache.get(1)).toBe('one');
    expect(cache.get(2)).toBe('two');
  });

  it('set() updates existing key without growing', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.size).toBe(3);

    // Update existing key
    cache.set('b', 20);
    expect(cache.size).toBe(3); // should not grow
    expect(cache.get('b')).toBe(20);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('eviction happens on set not get', () => {
    const cache = new LRUCache<string, number>(2);
    cache.set('a', 1);
    cache.set('b', 2);

    // get does NOT evict
    cache.get('a');
    expect(cache.size).toBe(2);

    // set triggers eviction when exceeding maxSize
    cache.set('c', 3);
    expect(cache.size).toBe(2);
  });

  it('TTL does not affect non-expired entries', () => {
    const cache = new LRUCache<string, number>(10, 5000);
    cache.set('a', 1);

    // Advance less than TTL
    vi.advanceTimersByTime(2000);

    expect(cache.get('a')).toBe(1);
    expect(cache.has('a')).toBe(true);
    expect(cache.entries()).toEqual([['a', 1]]);
  });
});
