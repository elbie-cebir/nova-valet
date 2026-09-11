import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, loadSeed, insertSlot, insertBooking } from './db';

/**
 * TONE-SETTING TEST — the domain's load-bearing guarantee.
 *
 * Invariant (CLAUDE.md #2, engineering-standards "no double-booking"):
 * two customers cannot book the same slot. Enforced by the partial unique
 * index `booking_one_active_per_slot`, NOT by application code. This test
 * fails (second insert succeeds) without the index and passes with it.
 */
describe('no double-booking [invariant: uniqueness constraint + reserve-then-confirm]', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = await freshDb();
    await loadSeed(db);
  });

  afterEach(async () => {
    await db.close();
  });

  it('two customers cannot book the same slot', async () => {
    const slotId = await insertSlot(db);

    // Customer A reserves the slot (deposit pending — an active booking).
    await insertBooking(db, {
      slotId,
      reference: 'NV-AAAA',
      status: 'pending_deposit',
    });

    // Customer B tries to reserve the same slot — the DB must reject it.
    await expect(
      insertBooking(db, {
        slotId,
        reference: 'NV-BBBB',
        status: 'pending_deposit',
      }),
    ).rejects.toThrow(/booking_one_active_per_slot|unique/i);

    const { rows } = await db.query<{ count: string }>(
      `select count(*)::text as count from booking where slot_id = $1`,
      [slotId],
    );
    expect(rows[0].count).toBe('1');
  });

  it('a cancelled booking frees the slot so it can be rebooked', async () => {
    const slotId = await insertSlot(db);

    await insertBooking(db, {
      slotId,
      reference: 'NV-CCCC',
      status: 'pending_deposit',
    });
    // Cancel it — moves out of the active set the partial index covers.
    await db.query(
      `update booking set status = 'cancelled' where reference = 'NV-CCCC'`,
    );

    // A new active booking on the same slot is now allowed.
    await expect(
      insertBooking(db, {
        slotId,
        reference: 'NV-DDDD',
        status: 'pending_deposit',
      }),
    ).resolves.not.toThrow();
  });

  it('rejects a confirmed booking colliding with a pending one on the same slot', async () => {
    const slotId = await insertSlot(db);
    await insertBooking(db, {
      slotId,
      reference: 'NV-EEEE',
      status: 'confirmed',
    });
    await expect(
      insertBooking(db, {
        slotId,
        reference: 'NV-FFFF',
        status: 'pending_deposit',
      }),
    ).rejects.toThrow(/booking_one_active_per_slot|unique/i);
  });
});
