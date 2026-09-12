import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb, insertSlot, insertBooking } from '../db/db';
import {
  setupPendingBooking,
  bookingStatus,
  slotStatus,
} from '../payments/helpers';
import { confirmPayment } from '@/lib/data/payment';
import { getBookingIdByReference, completeBooking } from '@/lib/data/booking';
import { issueMagicLink } from '@/lib/data/token';
import { getBookingEvents } from '@/lib/data/admin';
import { rescheduleByToken, cancelByToken } from '@/lib/booking/guest';

async function confirmed(db: PGlite, ref: string, pid: string) {
  const s = await setupPendingBooking(db, {
    reference: ref,
    provider: 'stripe',
    providerPaymentId: pid,
  });
  await confirmPayment(db, { provider: 'stripe', providerPaymentId: pid });
  return s;
}

async function paymentCount(db: PGlite, bookingId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(*)::text as n from payment where booking_id = $1`,
    [bookingId],
  );
  return Number(rows[0].n);
}
async function depositPaidAt(db: PGlite, bookingId: string) {
  const { rows } = await db.query<{ deposit_paid_at: string | null }>(
    `select deposit_paid_at from booking where id = $1`,
    [bookingId],
  );
  return rows[0].deposit_paid_at;
}

describe('guest self-service (token-scoped, fails closed)', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('reschedule before cutoff swaps slots atomically with NO new payment', async () => {
    const b = await confirmed(db, 'NV-GS0001', 'cs_gs_1'); // slot far in future
    const token = await issueMagicLink(db, b.bookingId);
    const target = await insertSlot(db);

    const paymentsBefore = await paymentCount(db, b.bookingId);
    const depositBefore = await depositPaidAt(db, b.bookingId);

    const res = await rescheduleByToken(db, { token, newSlotId: target });
    expect(res.ok).toBe(true);

    expect(await slotStatus(db, b.slotId)).toBe('open');
    expect(await slotStatus(db, target)).toBe('booked');
    expect(await bookingStatus(db, b.bookingId)).toBe('confirmed');
    expect(await paymentCount(db, b.bookingId)).toBe(paymentsBefore);
    expect(String(await depositPaidAt(db, b.bookingId))).toBe(
      String(depositBefore),
    );
    const events = await getBookingEvents(db, b.bookingId);
    expect(events[0].type).toBe('rescheduled');
    expect(events[0].actor).toBe('guest');
  });

  it('reschedule after cutoff is rejected server-side', async () => {
    const {
      rows: [near],
    } = await db.query<{ id: string }>(
      `insert into slot (start_at, end_at, status)
       values (now() + interval '1 hour', now() + interval '3 hours', 'booked')
       returning id`,
    );
    await insertBooking(db, {
      slotId: near.id,
      reference: 'NV-GS0002',
      status: 'confirmed',
    });
    const bookingId = (await getBookingIdByReference(db, 'NV-GS0002'))!;
    const token = await issueMagicLink(db, bookingId);
    const target = await insertSlot(db);

    const res = await rescheduleByToken(db, { token, newSlotId: target });
    expect(res).toEqual({ ok: false, reason: 'past_cutoff' });
    expect(await slotStatus(db, target)).toBe('open');
  });

  it('cancel releases the slot and forfeits the deposit', async () => {
    const b = await confirmed(db, 'NV-GS0003', 'cs_gs_3');
    const token = await issueMagicLink(db, b.bookingId);

    const res = await cancelByToken(db, { token });
    expect(res).toEqual({ ok: true });
    expect(await bookingStatus(db, b.bookingId)).toBe('cancelled');
    expect(await slotStatus(db, b.slotId)).toBe('open');
    expect(await depositPaidAt(db, b.bookingId)).not.toBeNull(); // forfeited, not refunded
    const events = await getBookingEvents(db, b.bookingId);
    expect(events[0].type).toBe('cancelled');
    expect(events[0].actor).toBe('guest');
  });

  it('fails closed: an unknown token cannot reschedule or cancel', async () => {
    const target = await insertSlot(db);
    expect(
      await rescheduleByToken(db, { token: 'garbage', newSlotId: target }),
    ).toEqual({ ok: false, reason: 'not_found' });
    expect(await cancelByToken(db, { token: '' })).toEqual({
      ok: false,
      reason: 'not_found',
    });
    expect(await slotStatus(db, target)).toBe('open');
  });

  it("a guest's token only acts on its OWN booking, never another's", async () => {
    const a = await confirmed(db, 'NV-GSA001', 'cs_gs_a');
    const bkB = await confirmed(db, 'NV-GSB001', 'cs_gs_b');
    const tokenA = await issueMagicLink(db, a.bookingId);

    // Cancelling with A's token cancels A only; B is untouched.
    await cancelByToken(db, { token: tokenA });
    expect(await bookingStatus(db, a.bookingId)).toBe('cancelled');
    expect(await bookingStatus(db, bkB.bookingId)).toBe('confirmed');
  });

  it('completed / cancelled bookings reject both actions', async () => {
    const done = await confirmed(db, 'NV-GS0004', 'cs_gs_4');
    await completeBooking(db, { bookingId: done.bookingId, actor: 'owner' });
    const tokenDone = await issueMagicLink(db, done.bookingId);
    const target = await insertSlot(db);
    expect(
      await rescheduleByToken(db, { token: tokenDone, newSlotId: target }),
    ).toEqual({ ok: false, reason: 'not_reschedulable' });
    expect(await cancelByToken(db, { token: tokenDone })).toEqual({
      ok: false,
      reason: 'not_cancellable',
    });

    const cancelled = await confirmed(db, 'NV-GS0005', 'cs_gs_5');
    const tokenCan = await issueMagicLink(db, cancelled.bookingId);
    await cancelByToken(db, { token: tokenCan });
    expect(await cancelByToken(db, { token: tokenCan })).toEqual({
      ok: false,
      reason: 'not_cancellable',
    });
    expect(
      await rescheduleByToken(db, { token: tokenCan, newSlotId: target }),
    ).toEqual({ ok: false, reason: 'not_reschedulable' });
  });
});
