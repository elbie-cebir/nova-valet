import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import { setupPendingBooking } from '../payments/helpers';
import { confirmPayment } from '@/lib/data/payment';
import { listBookings, countBookings, getAdminStats } from '@/lib/data/admin';
import { createSlots } from '@/lib/data/slots';

describe('admin bookings filters', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('filters to balance-outstanding confirmed bookings only', async () => {
    // Awaiting deposit (should NOT appear under balance filter).
    await setupPendingBooking(db, {
      reference: 'NV-FLT001',
      provider: 'stripe',
      providerPaymentId: 'cs_flt_1',
    });
    // Confirmed, balance outstanding (SHOULD appear).
    await setupPendingBooking(db, {
      reference: 'NV-FLT002',
      provider: 'stripe',
      providerPaymentId: 'cs_flt_2',
    });
    await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_flt_2',
    });

    const balance = await listBookings(db, {
      limit: 20,
      offset: 0,
      filter: 'balance',
    });
    expect(balance.map((b) => b.reference)).toEqual(['NV-FLT002']);
    expect(await countBookings(db, 'balance')).toBe(1);
    expect(await countBookings(db, 'completed')).toBe(0);
    expect(await countBookings(db, 'all')).toBe(2);
  });
});

describe('admin dashboard stats', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('counts upcoming, outstanding balances (+sum), and open slots this week', async () => {
    const b = await setupPendingBooking(db, {
      reference: 'NV-STAT01',
      provider: 'stripe',
      providerPaymentId: 'cs_stat_1',
    });
    await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_stat_1',
    });
    const { rows } = await db.query<{ balance_cents: number }>(
      `select balance_cents from booking where id = $1`,
      [b.bookingId],
    );
    const bal = Number(rows[0].balance_cents);

    const now = new Date();
    const week = {
      from: now.toISOString(),
      to: new Date(now.getTime() + 7 * 864e5).toISOString(),
    };
    // Baseline before adding a slot (the seed already opens some).
    const before = await getAdminStats(db, week);

    // One more open slot inside this week.
    await db.query(
      `insert into slot (start_at, end_at, status)
       values (now() + interval '2 days', now() + interval '2 days' + interval '2 hours', 'open')`,
    );

    const stats = await getAdminStats(db, week);
    expect(stats.upcoming).toBe(1);
    expect(stats.balancesOutstanding).toBe(1);
    expect(stats.balancesOutstandingCents).toBe(bal);
    expect(stats.openSlotsThisWeek).toBe(before.openSlotsThisWeek + 1);
  });
});

describe('bulk slot creation respects the buffer', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('creates well-spaced slots and skips ones too close', async () => {
    const ok = await createSlots(db, [
      '2026-11-10T09:00:00Z', // 09–11
      '2026-11-10T12:00:00Z', // 12–14 (1h gap — fine)
    ]);
    expect(ok).toEqual({ created: 2, skipped: 0 });

    const clash = await createSlots(db, [
      '2026-11-10T11:30:00Z', // clashes with 09–11 buffer
    ]);
    expect(clash).toEqual({ created: 0, skipped: 1 });
  });
});
