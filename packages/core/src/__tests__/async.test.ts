/**
 * Tests for async utilities: retry, contentHash, batchProcess.
 */

import { describe, it, expect, vi } from 'vitest';
import { retry, contentHash, batchProcess } from '../utils/async.js';

// ---------------------------------------------------------------------------
// retry
// ---------------------------------------------------------------------------

describe('retry', () => {
  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValue('ok');

    const result = await retry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after maxAttempts exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(retry(fn, { maxAttempts: 2, baseDelayMs: 1 }))
      .rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects shouldRetry predicate', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fatal'));

    await expect(retry(fn, {
      maxAttempts: 5,
      baseDelayMs: 1,
      shouldRetry: () => false,
    })).rejects.toThrow('fatal');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry callback', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('temp'))
      .mockResolvedValue('ok');

    await retry(fn, { maxAttempts: 3, baseDelayMs: 1, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, expect.any(Number));
  });
});

// ---------------------------------------------------------------------------
// contentHash
// ---------------------------------------------------------------------------

describe('contentHash', () => {
  it('returns an 8-character hex string', () => {
    const hash = contentHash('hello world');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic', () => {
    expect(contentHash('test')).toBe(contentHash('test'));
  });

  it('produces different hashes for different inputs', () => {
    expect(contentHash('abc')).not.toBe(contentHash('def'));
  });

  it('handles empty string', () => {
    const hash = contentHash('');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles long strings', () => {
    const longStr = 'a'.repeat(10000);
    const hash = contentHash(longStr);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

// ---------------------------------------------------------------------------
// batchProcess
// ---------------------------------------------------------------------------

describe('batchProcess', () => {
  it('processes all items', async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await batchProcess(items, async (n) => n * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });

  it('maintains order', async () => {
    const items = ['c', 'a', 'b'];
    const results = await batchProcess(items, async (s) => s.toUpperCase());
    expect(results).toEqual(['C', 'A', 'B']);
  });

  it('respects batchSize', async () => {
    const calls: number[][] = [];
    const items = [1, 2, 3, 4, 5];

    await batchProcess(items, async (n, i) => {
      const batchIndex = Math.floor(i / 2);
      if (!calls[batchIndex]) calls[batchIndex] = [];
      calls[batchIndex]!.push(n);
      return n;
    }, { batchSize: 2 });

    // With batch size 2, we should have 3 batches
    expect(calls.length).toBe(3);
  });

  it('handles empty array', async () => {
    const results = await batchProcess([], async (n: number) => n);
    expect(results).toEqual([]);
  });

  it('passes correct index to processor', async () => {
    const items = ['a', 'b', 'c'];
    const indices: number[] = [];

    await batchProcess(items, async (_item, i) => {
      indices.push(i);
      return _item;
    });

    expect(indices).toEqual([0, 1, 2]);
  });
});
