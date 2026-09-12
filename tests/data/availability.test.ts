import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb } from '../db/db';
import { getAvailableSlots } from '@/lib/data/availability';

/**
 * Availability is a read of OPEN slots only. Named for the invariant it
 * guards: a customer is never offered a held or booked slot.
 */
describe('availability query [only open slots are offered]', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await freshDb();
    // Four slots on 2026-10-02, one of each relevant status.
    await db.exec(`
      insert into slot (start_at, end_at, status) values
        ('2026-10-02T09:00:00Z','2026-10-02T11:00:00Z','open'),
        ('2026-10-02T11:00:00Z','2026-10-02T13:00:00Z','held'),
        ('2026-10-02T13:00:00Z','2026-10-02T15:00:00Z','booked'),
        ('2026-10-02T15:00:00Z','2026-10-02T17:00:00Z','open');
      -- an open slot OUTSIDE the queried range
      insert into slot (start_at, end_at, status) values
        ('2026-10-05T09:00:00Z','2026-10-05T11:00:00Z','open');
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  it('returns only open slots in the range, excluding held and booked', async () => {
    const slots = await getAvailableSlots(db, {
      from: '2026-10-02T00:00:00Z',
      to: '2026-10-03T00:00:00Z',
    });
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.startAt)).toEqual([
      '2026-10-02T09:00:00.000Z',
      '2026-10-02T15:00:00.000Z',
    ]);
  });

  it('excludes open slots outside the requested range', async () => {
    const slots = await getAvailableSlots(db, {
      from: '2026-10-02T00:00:00Z',
      to: '2026-10-03T00:00:00Z',
    });
    expect(slots.some((s) => s.startAt.startsWith('2026-10-05'))).toBe(false);
  });

  it('returns nothing when no open slots fall in the range', async () => {
    const slots = await getAvailableSlots(db, {
      from: '2026-11-01T00:00:00Z',
      to: '2026-11-02T00:00:00Z',
    });
    expect(slots).toEqual([]);
  });
});
