import { describe, it, expect } from 'vitest';
import { businessWallClockToUtcIso } from '@/lib/time';

describe('business wall-clock → UTC (Europe/Brussels, DST-aware)', () => {
  it('treats a summer date as CEST (UTC+2)', () => {
    // 13:00 Brussels in September = 11:00 UTC.
    expect(businessWallClockToUtcIso('2026-09-20T13:00')).toBe(
      '2026-09-20T11:00:00.000Z',
    );
  });

  it('treats a winter date as CET (UTC+1)', () => {
    // 13:00 Brussels in January = 12:00 UTC.
    expect(businessWallClockToUtcIso('2026-01-20T13:00')).toBe(
      '2026-01-20T12:00:00.000Z',
    );
  });

  it('rejects malformed input', () => {
    expect(businessWallClockToUtcIso('not-a-date')).toBeNull();
    expect(businessWallClockToUtcIso('')).toBeNull();
  });
});
