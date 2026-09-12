import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import {
  issueMagicLink,
  resolveBookingByToken,
  findBookingByReferenceAndContact,
} from '@/lib/data/token';
import { setupPendingBooking } from '../payments/helpers';

describe('guest tokens + lookup [token-scoped, fails closed]', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('a valid magic-link token resolves to exactly its booking', async () => {
    const { bookingId } = await setupPendingBooking(db, {
      reference: 'NV-TOK001',
      provider: 'stripe',
      providerPaymentId: 'cs_tok_1',
    });
    const raw = await issueMagicLink(db, bookingId);
    const booking = await resolveBookingByToken(db, raw);
    expect(booking?.reference).toBe('NV-TOK001');
  });

  it('an unknown token fails closed (null, no leak)', async () => {
    await setupPendingBooking(db, {
      reference: 'NV-TOK002',
      provider: 'stripe',
      providerPaymentId: 'cs_tok_2',
    });
    expect(await resolveBookingByToken(db, 'not-a-real-token')).toBeNull();
    expect(await resolveBookingByToken(db, '')).toBeNull();
  });

  it('an expired token fails closed', async () => {
    const { bookingId } = await setupPendingBooking(db, {
      reference: 'NV-TOK003',
      provider: 'stripe',
      providerPaymentId: 'cs_tok_3',
    });
    const raw = await issueMagicLink(db, bookingId);
    await db.query(
      `update booking_token set expires_at = now() - interval '1 day' where booking_id = $1`,
      [bookingId],
    );
    expect(await resolveBookingByToken(db, raw)).toBeNull();
  });

  it('a used token fails closed', async () => {
    const { bookingId } = await setupPendingBooking(db, {
      reference: 'NV-TOK004',
      provider: 'stripe',
      providerPaymentId: 'cs_tok_4',
    });
    const raw = await issueMagicLink(db, bookingId);
    await db.query(
      `update booking_token set used_at = now() where booking_id = $1`,
      [bookingId],
    );
    expect(await resolveBookingByToken(db, raw)).toBeNull();
  });

  it('a token never resolves to another booking', async () => {
    const a = await setupPendingBooking(db, {
      reference: 'NV-TOKAAA',
      provider: 'stripe',
      providerPaymentId: 'cs_tok_a',
    });
    await setupPendingBooking(db, {
      reference: 'NV-TOKBBB',
      provider: 'stripe',
      providerPaymentId: 'cs_tok_b',
    });
    const rawA = await issueMagicLink(db, a.bookingId);
    const resolved = await resolveBookingByToken(db, rawA);
    expect(resolved?.reference).toBe('NV-TOKAAA');
  });

  it('reference + matching contact resolves; wrong contact / wrong reference fail closed', async () => {
    // setupPendingBooking uses email pay@example.com, phone +320000000000.
    const { bookingId } = await setupPendingBooking(db, {
      reference: 'NV-TOK005',
      provider: 'stripe',
      providerPaymentId: 'cs_tok_5',
    });
    expect(
      await findBookingByReferenceAndContact(
        db,
        'NV-TOK005',
        'pay@example.com',
      ),
    ).toBe(bookingId);
    expect(
      await findBookingByReferenceAndContact(
        db,
        'nv-tok005',
        'PAY@EXAMPLE.COM',
      ),
    ).toBe(bookingId); // case-insensitive
    expect(
      await findBookingByReferenceAndContact(db, 'NV-TOK005', '+32 0000000000'),
    ).toBe(bookingId); // phone, spaces ignored
    expect(
      await findBookingByReferenceAndContact(
        db,
        'NV-TOK005',
        'wrong@example.com',
      ),
    ).toBeNull();
    expect(
      await findBookingByReferenceAndContact(
        db,
        'NV-WRONG0',
        'pay@example.com',
      ),
    ).toBeNull();
  });
});
