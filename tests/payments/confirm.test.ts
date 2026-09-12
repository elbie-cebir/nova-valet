import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import {
  confirmPayment,
  failPayment,
  recordInitiatedPayment,
} from '@/lib/data/payment';
import { setupPendingBooking, bookingStatus, slotStatus } from './helpers';

describe('payment confirmation [invariant: no confirmation without a provider-verified deposit]', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('a booking stays pending until a verified deposit confirms it', async () => {
    const { bookingId, slotId } = await setupPendingBooking(db, {
      reference: 'NV-PAY001',
      provider: 'stripe',
      providerPaymentId: 'cs_dep_1',
    });
    // Before confirm: held + pending, nothing paid.
    expect(await bookingStatus(db, bookingId)).toBe('pending_deposit');
    expect(await slotStatus(db, slotId)).toBe('held');

    const r = await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_dep_1',
    });
    expect(r).toMatchObject({ applied: true, kind: 'deposit' });
    expect(await bookingStatus(db, bookingId)).toBe('confirmed');
    expect(await slotStatus(db, slotId)).toBe('booked');

    const { rows } = await db.query<{ deposit_paid_at: string | null }>(
      `select deposit_paid_at from booking where id = $1`,
      [bookingId],
    );
    expect(rows[0].deposit_paid_at).not.toBeNull();
  });

  it('a redelivered webhook is idempotent (no double-apply)', async () => {
    const { bookingId } = await setupPendingBooking(db, {
      reference: 'NV-PAY002',
      provider: 'stripe',
      providerPaymentId: 'cs_dep_2',
    });
    const first = await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_dep_2',
    });
    const paidAt1 = (
      await db.query<{ deposit_paid_at: string }>(
        `select deposit_paid_at from booking where id = $1`,
        [bookingId],
      )
    ).rows[0].deposit_paid_at;

    const second = await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_dep_2',
    });
    const paidAt2 = (
      await db.query<{ deposit_paid_at: string }>(
        `select deposit_paid_at from booking where id = $1`,
        [bookingId],
      )
    ).rows[0].deposit_paid_at;

    expect(first.applied).toBe(true);
    expect(second).toMatchObject({ applied: false, reason: 'already_paid' });
    expect(String(paidAt2)).toBe(String(paidAt1)); // unchanged
    const paidCount = (
      await db.query<{ n: string }>(
        `select count(*)::text n from payment where provider='stripe' and provider_payment_id='cs_dep_2' and status='paid'`,
      )
    ).rows[0].n;
    expect(paidCount).toBe('1');
  });

  it('an unknown payment id is a no-op', async () => {
    const r = await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_nope',
    });
    expect(r).toMatchObject({ applied: false, reason: 'unknown_payment' });
  });

  it('balance payment sets balance_paid_at and is idempotent', async () => {
    const { bookingId } = await setupPendingBooking(db, {
      reference: 'NV-PAY003',
      provider: 'stripe',
      providerPaymentId: 'cs_dep_3',
    });
    await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_dep_3',
    });
    // Now pay the balance via a second payment.
    await recordInitiatedPayment(db, {
      bookingId,
      kind: 'balance',
      provider: 'stripe',
      method: 'card',
      providerPaymentId: 'cs_bal_3',
      amountCents: 11500,
    });
    const r = await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_bal_3',
    });
    expect(r).toMatchObject({ applied: true, kind: 'balance' });
    const bal1 = (
      await db.query<{ balance_paid_at: string }>(
        `select balance_paid_at from booking where id = $1`,
        [bookingId],
      )
    ).rows[0].balance_paid_at;
    expect(bal1).not.toBeNull();

    const again = await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_bal_3',
    });
    expect(again.applied).toBe(false);
  });

  it('a failed deposit releases the slot and expires the booking', async () => {
    const { bookingId, slotId } = await setupPendingBooking(db, {
      reference: 'NV-PAY004',
      provider: 'mollie',
      providerPaymentId: 'tr_fail_4',
      method: 'bancontact',
    });
    const r = await failPayment(db, {
      provider: 'mollie',
      providerPaymentId: 'tr_fail_4',
    });
    expect(r).toMatchObject({ applied: true, released: true });
    expect(await bookingStatus(db, bookingId)).toBe('expired');
    expect(await slotStatus(db, slotId)).toBe('open');
  });
});
