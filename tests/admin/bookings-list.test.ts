import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import { setupPendingBooking } from '../payments/helpers';
import { confirmPayment } from '@/lib/data/payment';
import { listBookings, countBookings, paymentStatusOf } from '@/lib/data/admin';

describe('owner bookings list + payment status', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('derives payment status from what the provider verified', () => {
    expect(
      paymentStatusOf({
        depositPaidAt: null,
        balancePaidAt: null,
        balanceCents: 1000,
      }),
    ).toBe('awaiting_deposit');
    expect(
      paymentStatusOf({
        depositPaidAt: 't',
        balancePaidAt: null,
        balanceCents: 1000,
      }),
    ).toBe('balance_outstanding');
    expect(
      paymentStatusOf({
        depositPaidAt: 't',
        balancePaidAt: 't2',
        balanceCents: 1000,
      }),
    ).toBe('fully_paid');
    expect(
      paymentStatusOf({
        depositPaidAt: 't',
        balancePaidAt: null,
        balanceCents: 0,
      }),
    ).toBe('fully_paid');
  });

  it('lists every booking with the correct payment status', async () => {
    // Awaiting deposit.
    await setupPendingBooking(db, {
      reference: 'NV-LIST01',
      provider: 'stripe',
      providerPaymentId: 'cs_list_1',
    });
    // Deposit paid, balance outstanding.
    await setupPendingBooking(db, {
      reference: 'NV-LIST02',
      provider: 'stripe',
      providerPaymentId: 'cs_list_2',
    });
    await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_list_2',
    });
    // Fully paid.
    const paid = await setupPendingBooking(db, {
      reference: 'NV-LIST03',
      provider: 'stripe',
      providerPaymentId: 'cs_list_3',
    });
    await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_list_3',
    });
    await db.query(`update booking set balance_paid_at = now() where id = $1`, [
      paid.bookingId,
    ]);

    expect(await countBookings(db)).toBe(3);

    const rows = await listBookings(db, { limit: 20, offset: 0 });
    const byRef = Object.fromEntries(rows.map((r) => [r.reference, r]));
    expect(byRef['NV-LIST01'].paymentStatus).toBe('awaiting_deposit');
    expect(byRef['NV-LIST02'].paymentStatus).toBe('balance_outstanding');
    expect(byRef['NV-LIST03'].paymentStatus).toBe('fully_paid');
    // Display fields are joined in for the list.
    expect(byRef['NV-LIST01'].customerName).toBe('Payment Tester');
    expect(byRef['NV-LIST01'].serviceName).toBeTruthy();
  });

  it('is bounded: limit + offset paginate, never an unbounded read', async () => {
    for (let i = 0; i < 3; i++) {
      await setupPendingBooking(db, {
        reference: `NV-PAGE0${i}`,
        provider: 'stripe',
        providerPaymentId: `cs_page_${i}`,
      });
    }
    const firstPage = await listBookings(db, { limit: 2, offset: 0 });
    const secondPage = await listBookings(db, { limit: 2, offset: 2 });
    expect(firstPage).toHaveLength(2);
    expect(secondPage).toHaveLength(1);
  });
});
