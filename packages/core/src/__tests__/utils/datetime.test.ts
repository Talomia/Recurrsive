import { describe, it, expect, vi, afterEach } from 'vitest';
import { nowISO, toISO, fromISO, durationMs, formatDuration, isOlderThan } from '../../utils/datetime.js';

// ---------------------------------------------------------------------------
// nowISO
// ---------------------------------------------------------------------------
describe('nowISO', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a string', () => {
    expect(typeof nowISO()).toBe('string');
  });

  it('returns a valid ISO 8601 string', () => {
    const iso = nowISO();
    // ISO 8601 with milliseconds and trailing Z
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    expect(iso).toMatch(isoRegex);
  });

  it('returns a string parseable by Date constructor', () => {
    const iso = nowISO();
    const date = new Date(iso);
    expect(date.getTime()).not.toBeNaN();
  });

  it('returns a value close to the current time', () => {
    const before = Date.now();
    const iso = nowISO();
    const after = Date.now();
    const parsed = new Date(iso).getTime();
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });

  it('returns a known timestamp when Date is faked', () => {
    const fakeDate = new Date('2024-06-15T12:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(fakeDate);

    expect(nowISO()).toBe('2024-06-15T12:00:00.000Z');
  });

  it('returns different values when called with delay', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    const first = nowISO();
    vi.advanceTimersByTime(1000);
    const second = nowISO();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// toISO
// ---------------------------------------------------------------------------
describe('toISO', () => {
  it('converts a Date to an ISO string', () => {
    const date = new Date('2024-01-15T09:30:00.000Z');
    expect(toISO(date)).toBe('2024-01-15T09:30:00.000Z');
  });

  it('returns a string matching ISO 8601 format', () => {
    const result = toISO(new Date());
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('preserves milliseconds', () => {
    const date = new Date('2024-01-01T00:00:00.123Z');
    expect(toISO(date)).toBe('2024-01-01T00:00:00.123Z');
  });

  it('handles epoch (0)', () => {
    const epoch = new Date(0);
    expect(toISO(epoch)).toBe('1970-01-01T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// fromISO
// ---------------------------------------------------------------------------
describe('fromISO', () => {
  it('parses a valid ISO string into a Date', () => {
    const date = fromISO('2024-01-15T09:30:00.000Z');
    expect(date).toBeInstanceOf(Date);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getUTCMonth()).toBe(0); // January
    expect(date.getUTCDate()).toBe(15);
  });

  it('round-trips with toISO', () => {
    const original = '2024-06-15T12:34:56.789Z';
    const date = fromISO(original);
    expect(toISO(date)).toBe(original);
  });

  it('throws for an invalid ISO string', () => {
    expect(() => fromISO('not-a-date')).toThrow('Invalid ISO-8601 datetime string');
  });

  it('throws for an empty string', () => {
    expect(() => fromISO('')).toThrow('Invalid ISO-8601 datetime string');
  });

  it('includes the offending string in the error message', () => {
    expect(() => fromISO('garbage')).toThrow('"garbage"');
  });

  it('parses a date-only string (browser-dependent but valid in V8)', () => {
    const date = fromISO('2024-01-15');
    expect(date.getFullYear()).toBe(2024);
  });
});

// ---------------------------------------------------------------------------
// durationMs
// ---------------------------------------------------------------------------
describe('durationMs', () => {
  it('returns 60000 ms for a one-minute gap', () => {
    const ms = durationMs('2024-01-15T09:00:00.000Z', '2024-01-15T09:01:00.000Z');
    expect(ms).toBe(60_000);
  });

  it('returns 0 for identical timestamps', () => {
    const ts = '2024-01-15T09:00:00.000Z';
    expect(durationMs(ts, ts)).toBe(0);
  });

  it('returns a negative number when end is before start', () => {
    const ms = durationMs('2024-01-15T10:00:00.000Z', '2024-01-15T09:00:00.000Z');
    expect(ms).toBeLessThan(0);
  });

  it('defaults end to now when omitted', () => {
    const past = '2020-01-01T00:00:00.000Z';
    const ms = durationMs(past);
    expect(ms).toBeGreaterThan(0);
  });

  it('throws if start is invalid', () => {
    expect(() => durationMs('bad-date')).toThrow('Invalid ISO-8601 datetime string');
  });

  it('throws if end is invalid', () => {
    expect(() => durationMs('2024-01-01T00:00:00.000Z', 'bad-date')).toThrow(
      'Invalid ISO-8601 datetime string',
    );
  });

  it('calculates multi-day durations correctly', () => {
    const ms = durationMs('2024-01-01T00:00:00.000Z', '2024-01-03T00:00:00.000Z');
    expect(ms).toBe(2 * 24 * 60 * 60 * 1000);
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------
describe('formatDuration', () => {
  it('formats sub-second durations as milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats exact seconds', () => {
    expect(formatDuration(1000)).toBe('1s');
    expect(formatDuration(5000)).toBe('5s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(90_000)).toBe('1m 30s');
    expect(formatDuration(150_000)).toBe('2m 30s');
  });

  it('formats exact minutes', () => {
    expect(formatDuration(60_000)).toBe('1m');
    expect(formatDuration(120_000)).toBe('2m');
  });

  it('formats hours and minutes', () => {
    expect(formatDuration(3_600_000 + 900_000)).toBe('1h 15m');
  });

  it('formats exact hours', () => {
    expect(formatDuration(3_600_000)).toBe('1h');
  });

  it('formats days and hours', () => {
    expect(formatDuration(86_400_000 + 3_600_000)).toBe('1d 1h');
  });

  it('formats exact days', () => {
    expect(formatDuration(86_400_000)).toBe('1d');
    expect(formatDuration(2 * 86_400_000)).toBe('2d');
  });

  it('rounds millisecond values', () => {
    expect(formatDuration(1.7)).toBe('2ms');
    expect(formatDuration(0.3)).toBe('0ms');
  });
});

// ---------------------------------------------------------------------------
// isOlderThan
// ---------------------------------------------------------------------------
describe('isOlderThan', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for a timestamp far in the past', () => {
    expect(isOlderThan('2000-01-01T00:00:00.000Z', 30)).toBe(true);
  });

  it('returns false for a timestamp in the future', () => {
    const future = new Date(Date.now() + 86_400_000 * 365).toISOString();
    expect(isOlderThan(future, 30)).toBe(false);
  });

  it('returns false for a very recent timestamp with large day threshold', () => {
    const recent = new Date().toISOString();
    expect(isOlderThan(recent, 365)).toBe(false);
  });

  it('handles 0-day threshold (any past timestamp is older)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-15T12:00:00.000Z'));
    // Exactly now should NOT be older than 0 days (same millisecond)
    expect(isOlderThan('2024-06-15T12:00:00.000Z', 0)).toBe(false);
    // 1ms in the past IS older than 0 days
    expect(isOlderThan('2024-06-15T11:59:59.999Z', 0)).toBe(true);
  });

  it('throws for invalid ISO strings', () => {
    expect(() => isOlderThan('bad', 5)).toThrow('Invalid ISO-8601 datetime string');
  });
});
