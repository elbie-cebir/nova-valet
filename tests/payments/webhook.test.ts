import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import Stripe from 'stripe';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import { verifyStripeEvent } from '@/lib/payments/stripe';
import { applyStripeEvent, applyMollieNotify } from '@/lib/payments/webhooks';
import type { PaymentGateway, ProviderStatus } from '@/lib/payments/types';
import { setupPendingBooking, bookingStatus, slotStatus } from './helpers';

const SECRET = 'whsec_test_secret';

beforeAll(() => {
  // Offline crypto only — no live keys / network.
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});

function signedEvent(sessionId: string) {
  const payload = JSON.stringify({
    id: 'evt_1',
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        payment_status: 'paid',
      },
    },
  });
  const stripe = new Stripe('sk_test_dummy');
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: SECRET,
  });
  return { payload, signature };
}

describe('webhook verification + apply', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('rejects a forged Stripe signature', () => {
    const { payload } = signedEvent('cs_x');
    expect(() => verifyStripeEvent(payload, 't=1,v1=deadbeef')).toThrow();
  });

  it('accepts a validly-signed event and confirms only then', async () => {
    const { bookingId, slotId } = await setupPendingBooking(db, {
      reference: 'NV-WH001',
      provider: 'stripe',
      providerPaymentId: 'cs_wh_1',
    });
    const { payload, signature } = signedEvent('cs_wh_1');

    const event = verifyStripeEvent(payload, signature); // no throw
    expect(event.type).toBe('checkout.session.completed');

    const r = await applyStripeEvent(db, event);
    expect(r.applied).toBe(true);
    expect(await bookingStatus(db, bookingId)).toBe('confirmed');
    expect(await slotStatus(db, slotId)).toBe('booked');
  });

  it('Mollie notify never trusts the caller — only a fetched "paid" confirms', async () => {
    const { bookingId, slotId } = await setupPendingBooking(db, {
      reference: 'NV-WH002',
      provider: 'mollie',
      providerPaymentId: 'tr_wh_2',
      method: 'bancontact',
    });
    const gatewayReturning = (status: ProviderStatus): PaymentGateway => ({
      provider: 'mollie',
      createCheckout: async () => ({
        provider: 'mollie',
        providerPaymentId: '',
        checkoutUrl: '',
      }),
      getStatus: async () => status,
    });

    // Fetched status 'open' → must NOT confirm.
    await applyMollieNotify(db, gatewayReturning('open'), 'tr_wh_2');
    expect(await bookingStatus(db, bookingId)).toBe('pending_deposit');
    expect(await slotStatus(db, slotId)).toBe('held');

    // Fetched status 'paid' → confirms.
    const r = await applyMollieNotify(db, gatewayReturning('paid'), 'tr_wh_2');
    expect(r.applied).toBe(true);
    expect(await bookingStatus(db, bookingId)).toBe('confirmed');
    expect(await slotStatus(db, slotId)).toBe('booked');
  });
});
