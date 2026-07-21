import { describe, it, expect } from 'vitest';
import { nextCronRun } from '../routes/scheduling.js';

/**
 * Regression: `parseCronField('*')` expands to the full set, so a "*" day
 * field always "matched" — the day-skip condition never fired and every
 * schedule's nextRunAt landed on the next day (fired daily). These assert
 * the corrected standard cron day semantics.
 */
describe('nextCronRun day-of-week / day-of-month semantics', () => {
  it('a weekly schedule (Mondays) lands on a Monday, not "tomorrow"', () => {
    const next = new Date(nextCronRun('0 9 * * 1'));
    expect(next.getDay()).toBe(1); // 1 = Monday (local time, as computed)
  });

  it('a Friday schedule lands on a Friday', () => {
    const next = new Date(nextCronRun('30 17 * * 5'));
    expect(next.getDay()).toBe(5);
  });

  it('a monthly schedule (15th) lands on the 15th', () => {
    const next = new Date(nextCronRun('0 9 15 * *'));
    expect(next.getDate()).toBe(15);
  });

  it('honors the hour/minute of a daily schedule', () => {
    const next = new Date(nextCronRun('30 14 * * *'));
    expect(next.getHours()).toBe(14);
    expect(next.getMinutes()).toBe(30);
  });

  it('returns a valid future ISO timestamp', () => {
    const next = nextCronRun('0 9 * * 1');
    expect(() => new Date(next).toISOString()).not.toThrow();
    expect(new Date(next).getTime()).toBeGreaterThan(Date.now());
  });
});
