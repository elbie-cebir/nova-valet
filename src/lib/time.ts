import { BUSINESS_TIMEZONE } from '@/config/constants';

/**
 * Convert a wall-clock `datetime-local` value (e.g. "2026-09-20T13:00"),
 * entered by the owner in BUSINESS time, into the correct UTC instant — honouring
 * whether Brussels is on CET or CEST for that date. Returns null on garbage.
 *
 * The owner always thinks in Brussels time (ADR-015); slots are stored in UTC.
 */
export function businessWallClockToUtcIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)) return null;
  // Start by pretending the wall-clock is already UTC.
  const asIfUtc = new Date(local + 'Z');
  if (Number.isNaN(asIfUtc.getTime())) return null;
  // How far the business zone is from UTC at that instant.
  const inTz = new Date(
    asIfUtc.toLocaleString('en-US', { timeZone: BUSINESS_TIMEZONE }),
  );
  const inUtc = new Date(asIfUtc.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = inTz.getTime() - inUtc.getTime();
  return new Date(asIfUtc.getTime() - offsetMs).toISOString();
}
