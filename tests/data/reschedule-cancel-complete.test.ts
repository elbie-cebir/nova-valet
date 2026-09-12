import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb, insertSlot, insertBooking } from '../db/db';
import {
  setupPendingBooking,
  bookingStatus,
  slotStatus,
} from '../payments/helpers';
import { confirmPayment } from '@/lib/data/payment';
import {
  rescheduleBooking,
  cancelBooking,
  completeBooking,
  getBookingIdByReference,
} from '@/lib/data/booking';
import { getBookingEvents, getPaymentsForBooking } from '@/lib/data/admin';

const OWNER = 'owner@nova.be';

async function confirmedBooking(db: PGlite, ref: string, pid: string) {
  const s = await setupPendingBooking(db, {
    reference: ref,
    provider: 'stripe',
    providerPaymentId: pid,
  });
  await confirmPayment(db, { provider: 'stripe', providerPaymentId: pid });
  return s; // { bookingId, slotId, ... }
}

async function paymentCount(db: PGlite, bookingId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(*)::text as n from payment where booking_id = $1`,
    [bookingId],
  );
  return Number(rows[0].n);
}

async function depositPaidAt(
  db: PGlite,
  bookingId: string,
): Promise<string | null> {
  const { rows } = await db.query<{ deposit_paid_at: string | null }>(
    `select deposit_paid_at from booking where id = $1`,
    [bookingId],
  );
  return rows[0].deposit_paid_at;
}

describe('owner reschedule / cancel / complete', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('reschedule before the cutoff swaps slots atomically with NO new deposit', async () => {
    const b = await confirmedBooking(db, 'NV-RES001', 'cs_res_1'); // slot far in future
    const target = await insertSlot(db); // a fresh open slot

    const paymentsBefore = await paymentCount(db, b.bookingId);
    const depositBefore = await depositPaidAt(db, b.bookingId);

    const res = await rescheduleBooking(db, {
      bookingId: b.bookingId,
      newSlotId: target,
      actor: OWNER,
    });
    expect(res.ok).toBe(true);

    // Old slot freed, new slot booked, booking repointed and still confirmed.
    expect(await slotStatus(db, b.slotId)).toBe('open');
    expect(await slotStatus(db, target)).toBe('booked');
    expect(await bookingStatus(db, b.bookingId)).toBe('confirmed');
    const { rows } = await db.query<{ slot_id: string }>(
      `select slot_id from booking where id = $1`,
      [b.bookingId],
    );
    expect(rows[0].slot_id).toBe(target);

    // No new deposit: no payment rows added, deposit timestamp untouched.
    expect(await paymentCount(db, b.bookingId)).toBe(paymentsBefore);
    // Date objects from PGlite: compare by value, not identity.
    expect(String(await depositPaidAt(db, b.bookingId))).toBe(
      String(depositBefore),
    );

    // Attributed + recorded.
    const events = await getBookingEvents(db, b.bookingId);
    expect(events[0].type).toBe('rescheduled');
    expect(events[0].actor).toBe(OWNER);
    expect(events[0].detail.to_slot).toBe(target);
  });

  it('reschedule after the cutoff is rejected', async () => {
    // A confirmed booking whose slot starts in 1 hour — inside the 24h cutoff.
    const {
      rows: [near],
    } = await db.query<{ id: string }>(
      `insert into slot (start_at, end_at, status)
       values (now() + interval '1 hour', now() + interval '3 hours', 'booked')
       returning id`,
    );
    await insertBooking(db, {
      slotId: near.id,
      reference: 'NV-RES002',
      status: 'confirmed',
    });
    const bookingId = (await getBookingIdByReference(db, 'NV-RES002'))!;
    const target = await insertSlot(db);

    const res = await rescheduleBooking(db, {
      bookingId,
      newSlotId: target,
      actor: OWNER,
    });
    expect(res).toEqual({ ok: false, reason: 'past_cutoff' });
    // Nothing moved.
    expect(await slotStatus(db, target)).toBe('open');
  });

  it('cancel releases the slot and FORFEITS the (non-refundable) deposit', async () => {
    const b = await confirmedBooking(db, 'NV-CAN001', 'cs_can_1');

    const res = await cancelBooking(db, {
      bookingId: b.bookingId,
      actor: OWNER,
    });
    expect(res).toEqual({ ok: true });

    expect(await bookingStatus(db, b.bookingId)).toBe('cancelled');
    expect(await slotStatus(db, b.slotId)).toBe('open'); // released, rebookable

    // Deposit is forfeited, NOT refunded: the paid payment row is untouched.
    expect(await depositPaidAt(db, b.bookingId)).not.toBeNull();
    const payments = await getPaymentsForBooking(db, b.bookingId);
    expect(payments.every((p) => p.status === 'paid')).toBe(true);

    const events = await getBookingEvents(db, b.bookingId);
    expect(events[0].type).toBe('cancelled');
    expect(events[0].actor).toBe(OWNER);
    expect(events[0].detail.deposit_forfeited).toBe(true);
  });

  it('complete moves confirmed → completed and keeps the slot booked', async () => {
    const b = await confirmedBooking(db, 'NV-CMP001', 'cs_cmp_1');

    const res = await completeBooking(db, {
      bookingId: b.bookingId,
      actor: OWNER,
    });
    expect(res).toEqual({ ok: true });
    expect(await bookingStatus(db, b.bookingId)).toBe('completed');
    expect(await slotStatus(db, b.slotId)).toBe('booked');

    const events = await getBookingEvents(db, b.bookingId);
    expect(events[0].type).toBe('completed');
  });

  it('complete is rejected unless the booking is confirmed', async () => {
    const b = await setupPendingBooking(db, {
      reference: 'NV-CMP002',
      provider: 'stripe',
      providerPaymentId: 'cs_cmp_2',
    });
    const res = await completeBooking(db, {
      bookingId: b.bookingId,
      actor: OWNER,
    });
    expect(res).toEqual({ ok: false, reason: 'not_completable' });
  });
});
