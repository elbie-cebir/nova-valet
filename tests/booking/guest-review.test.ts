import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import { setupPendingBooking } from '../payments/helpers';
import { confirmPayment } from '@/lib/data/payment';
import { issueMagicLink } from '@/lib/data/token';
import { reviewByToken } from '@/lib/booking/guest';
import {
  hasGuestReview,
  getPublishedReviews,
  listReviewsAdmin,
} from '@/lib/data/reviews';

/**
 * Guest "rate your service" (token-scoped). Only a fully-paid booking can be
 * rated, once; the review is created UNPUBLISHED (owner approves in admin).
 */
describe('guest rate-your-service', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  async function fullyPaid(ref: string, pid: string) {
    const s = await setupPendingBooking(db, {
      reference: ref,
      provider: 'stripe',
      providerPaymentId: pid,
    });
    await confirmPayment(db, { provider: 'stripe', providerPaymentId: pid });
    await db.query(`update booking set balance_paid_at = now() where id = $1`, [
      s.bookingId,
    ]);
    return s;
  }

  it('rates a fully-paid booking once; review is unpublished + admin-visible', async () => {
    const b = await fullyPaid('NV-RV0001', 'cs_rv_1');
    const token = await issueMagicLink(db, b.bookingId);

    const res = await reviewByToken(db, {
      token,
      rating: 5,
      body: 'Spotless!',
    });
    expect(res.ok).toBe(true);
    expect(await hasGuestReview(db, b.bookingId)).toBe(true);

    // Unpublished → hidden from the public read, but present in admin.
    expect(await getPublishedReviews(db)).toEqual([]);
    const admin = await listReviewsAdmin(db);
    expect(admin).toHaveLength(1);
    expect(admin[0].rating).toBe(5);
    expect(admin[0].published).toBe(false);

    // Second attempt → already reviewed (one per booking).
    const again = await reviewByToken(db, { token, rating: 3, body: 'x' });
    expect(again).toEqual({ ok: false, reason: 'already_reviewed' });
  });

  it('rejects rating a booking whose balance is still due', async () => {
    const s = await setupPendingBooking(db, {
      reference: 'NV-RV0002',
      provider: 'stripe',
      providerPaymentId: 'cs_rv_2',
    });
    await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_rv_2',
    });
    await db.query(
      `update booking set balance_cents = 2500, balance_paid_at = null where id = $1`,
      [s.bookingId],
    );
    const token = await issueMagicLink(db, s.bookingId);

    const res = await reviewByToken(db, { token, rating: 5, body: '' });
    expect(res).toEqual({ ok: false, reason: 'not_allowed' });
    expect(await hasGuestReview(db, s.bookingId)).toBe(false);
  });

  it('fails closed on an unknown token', async () => {
    const res = await reviewByToken(db, { token: 'nope', rating: 5, body: '' });
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });
});
