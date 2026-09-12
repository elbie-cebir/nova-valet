import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import {
  confirmPayment,
  recordInitiatedPayment,
  findOpenPayment,
} from '@/lib/data/payment';
import { releaseExpiredHolds } from '@/lib/data/booking';
import { setupPendingBooking, bookingStatus, slotStatus } from './helpers';

async function paymentStatus(db: PGlite, pid: string): Promise<string> {
  const { rows } = await db.query<{ status: string }>(
    `select status from payment where provider_payment_id = $1`,
    [pid],
  );
  return rows[0].status;
}

describe('overpayment safety [no refund hell]', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('a second successful deposit is flagged refund_due, not double-applied', async () => {
    const { bookingId, slotId } = await setupPendingBooking(db, {
      reference: 'NV-DUP001',
      provider: 'stripe',
      providerPaymentId: 'cs_dup_a',
    });
    // First deposit confirms the booking.
    expect(
      (
        await confirmPayment(db, {
          provider: 'stripe',
          providerPaymentId: 'cs_dup_a',
        })
      ).applied,
    ).toBe(true);

    // A second, distinct deposit payment lands paid on the same booking.
    await recordInitiatedPayment(db, {
      bookingId,
      kind: 'deposit',
      provider: 'stripe',
      method: 'card',
      providerPaymentId: 'cs_dup_b',
      amountCents: 2500,
    });
    const second = await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_dup_b',
    });

    expect(second).toMatchObject({ applied: false, reason: 'refund_due' });
    expect(await paymentStatus(db, 'cs_dup_b')).toBe('refund_due');
    // Booking confirmed exactly once; slot booked once; not double-applied.
    expect(await bookingStatus(db, bookingId)).toBe('confirmed');
    expect(await slotStatus(db, slotId)).toBe('booked');
  });

  it('a deposit paid after the hold expired is flagged refund_due, booking not confirmed', async () => {
    const { bookingId, slotId } = await setupPendingBooking(db, {
      reference: 'NV-LATE001',
      provider: 'mollie',
      providerPaymentId: 'tr_late',
      method: 'bancontact',
    });
    // Hold lapses and is swept → booking expired, slot released.
    await db.query(
      `update slot set held_until = now() - interval '1 minute' where id = $1`,
      [slotId],
    );
    await releaseExpiredHolds(db);
    expect(await bookingStatus(db, bookingId)).toBe('expired');
    expect(await slotStatus(db, slotId)).toBe('open');

    // The (late) payment then succeeds — must NOT confirm; flagged for refund.
    const r = await confirmPayment(db, {
      provider: 'mollie',
      providerPaymentId: 'tr_late',
    });
    expect(r).toMatchObject({ applied: false, reason: 'refund_due' });
    expect(await paymentStatus(db, 'tr_late')).toBe('refund_due');
    expect(await bookingStatus(db, bookingId)).toBe('expired');
    expect(await slotStatus(db, slotId)).toBe('open');
  });

  it('reuses an open checkout instead of creating a second (double-payment guard)', async () => {
    const { bookingId } = await setupPendingBooking(db, {
      reference: 'NV-REUSE1',
      provider: 'stripe',
      providerPaymentId: 'cs_reuse_1',
    });
    // Record an open checkout WITH a url (as the action does).
    await recordInitiatedPayment(db, {
      bookingId,
      kind: 'deposit',
      provider: 'stripe',
      method: 'card',
      providerPaymentId: 'cs_reuse_2',
      amountCents: 2500,
      checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_reuse_2',
    });
    const open = await findOpenPayment(db, bookingId, 'deposit');
    expect(open?.checkoutUrl).toBe(
      'https://checkout.stripe.com/c/pay/cs_reuse_2',
    );

    // Once paid, it's no longer an open checkout to reuse.
    await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_reuse_2',
    });
    expect(await findOpenPayment(db, bookingId, 'deposit')).toBeNull();
  });
});
