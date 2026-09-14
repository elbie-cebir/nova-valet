import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import {
  reserveSlot,
  releaseExpiredHolds,
  getTierPrice,
  type ReserveParams,
} from '@/lib/data/booking';
import { HOLD_TTL_MINUTES } from '@/config/constants';

async function insertOpenSlot(db: PGlite): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into slot (start_at, end_at, status)
     values ('2026-10-10T09:00:00Z','2026-10-10T11:00:00Z','open') returning id`,
  );
  return rows[0].id;
}

async function baseParams(
  db: PGlite,
  slotId: string,
  reference: string,
): Promise<ReserveParams> {
  const { rows } = await db.query<{ id: string }>(
    `select id from service where key = 'full'`,
  );
  const serviceId = rows[0].id;
  const price = await getTierPrice(db, serviceId, 'medium');
  if (!price) throw new Error('seed missing full/medium price');
  return {
    slotId,
    serviceId,
    tierId: price.tierId,
    customerName: 'Test Guest',
    customerPhone: '+32470000000',
    customerEmail: 'guest@example.com',
    address: '1 Placeholder St',
    postcode: '1000',
    locale: 'nl',
    reference,
    travelFeeCents: 0,
    subtotalCents: price.amountCents,
    totalCents: price.amountCents,
    depositCents: 2500,
    balanceCents: price.amountCents - 2500,
    addOns: [],
    holdTtlMinutes: HOLD_TTL_MINUTES,
  };
}

async function slotRow(db: PGlite, slotId: string) {
  const { rows } = await db.query<{
    status: string;
    held_until: string | null;
    booking_id: string | null;
  }>(`select status, held_until, booking_id from slot where id = $1`, [slotId]);
  return rows[0];
}

describe('slot reserve-then-confirm [invariant: hold with TTL, confirm on deposit]', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('selecting a slot holds it: open→held, TTL set, booking pending_deposit', async () => {
    const slotId = await insertOpenSlot(db);
    const res = await reserveSlot(
      db,
      await baseParams(db, slotId, 'NV-HOLD01'),
    );
    expect(res.ok).toBe(true);

    const slot = await slotRow(db, slotId);
    expect(slot.status).toBe('held');
    expect(slot.held_until).not.toBeNull();
    expect(new Date(slot.held_until!).getTime()).toBeGreaterThan(Date.now());
    expect(slot.booking_id).not.toBeNull();

    const { rows } = await db.query<{ status: string; slot_id: string }>(
      `select status, slot_id from booking where reference = 'NV-HOLD01'`,
    );
    expect(rows[0].status).toBe('pending_deposit');
    expect(rows[0].slot_id).toBe(slotId);
  });

  it('a concurrent booking on the same held slot is rejected', async () => {
    const slotId = await insertOpenSlot(db);
    const a = await reserveSlot(db, await baseParams(db, slotId, 'NV-CONC0A'));
    expect(a.ok).toBe(true);

    const b = await reserveSlot(db, await baseParams(db, slotId, 'NV-CONC0B'));
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.reason).toBe('slot_unavailable');

    const { rows } = await db.query<{ n: string }>(
      `select count(*)::text as n from booking
       where slot_id = $1 and status in ('pending_deposit','confirmed','completed')`,
      [slotId],
    );
    expect(rows[0].n).toBe('1');
  });

  it('a booking on a slot whose hold expired succeeds; the stale booking expires', async () => {
    const slotId = await insertOpenSlot(db);
    const a = await reserveSlot(db, await baseParams(db, slotId, 'NV-EXP00A'));
    expect(a.ok).toBe(true);

    // Simulate the hold lapsing.
    await db.query(
      `update slot set held_until = now() - interval '1 minute' where id = $1`,
      [slotId],
    );

    const b = await reserveSlot(db, await baseParams(db, slotId, 'NV-EXP00B'));
    expect(b.ok).toBe(true);

    const statuses = await db.query<{ reference: string; status: string }>(
      `select reference, status from booking where reference in ('NV-EXP00A','NV-EXP00B')`,
    );
    const byRef = Object.fromEntries(
      statuses.rows.map((r) => [r.reference, r.status]),
    );
    expect(byRef['NV-EXP00A']).toBe('expired');
    expect(byRef['NV-EXP00B']).toBe('pending_deposit');

    const slot = await slotRow(db, slotId);
    expect(slot.status).toBe('held');
  });

  it('reserving a non-open (e.g. booked) slot is rejected', async () => {
    const slotId = await insertOpenSlot(db);
    await db.query(`update slot set status = 'booked' where id = $1`, [slotId]);
    const res = await reserveSlot(
      db,
      await baseParams(db, slotId, 'NV-BOOK01'),
    );
    expect(res.ok).toBe(false);
  });

  it('releaseExpiredHolds frees a lapsed hold and expires its booking', async () => {
    const slotId = await insertOpenSlot(db);
    await reserveSlot(db, await baseParams(db, slotId, 'NV-SWEEP1'));
    await db.query(
      `update slot set held_until = now() - interval '1 minute' where id = $1`,
      [slotId],
    );

    const freed = await releaseExpiredHolds(db);
    expect(freed).toBe(1);

    const slot = await slotRow(db, slotId);
    expect(slot.status).toBe('open');
    expect(slot.booking_id).toBeNull();

    const { rows } = await db.query<{ status: string }>(
      `select status from booking where reference = 'NV-SWEEP1'`,
    );
    expect(rows[0].status).toBe('expired');
  });

  it('stores lat/lng/formatted_address when a suggestion was picked', async () => {
    const slotId = await insertOpenSlot(db);
    const p = await baseParams(db, slotId, 'NV-GEO001');
    const res = await reserveSlot(db, {
      ...p,
      latitude: 50.8467,
      longitude: 4.3517,
      formattedAddress: 'Grote Markt 1, 1000 Brussels',
    });
    expect(res.ok).toBe(true);
    const { rows } = await db.query<{
      latitude: number;
      longitude: number;
      formatted_address: string;
    }>(
      `select latitude, longitude, formatted_address from booking where reference = 'NV-GEO001'`,
    );
    expect(Number(rows[0].latitude)).toBeCloseTo(50.8467, 4);
    expect(Number(rows[0].longitude)).toBeCloseTo(4.3517, 4);
    expect(rows[0].formatted_address).toBe('Grote Markt 1, 1000 Brussels');
  });

  it('a manual address (no suggestion) books with null coordinates', async () => {
    const slotId = await insertOpenSlot(db);
    const res = await reserveSlot(
      db,
      await baseParams(db, slotId, 'NV-GEO002'),
    );
    expect(res.ok).toBe(true);
    const { rows } = await db.query<{
      latitude: number | null;
      longitude: number | null;
      formatted_address: string | null;
    }>(
      `select latitude, longitude, formatted_address from booking where reference = 'NV-GEO002'`,
    );
    expect(rows[0].latitude).toBeNull();
    expect(rows[0].longitude).toBeNull();
    expect(rows[0].formatted_address).toBeNull();
  });
});
