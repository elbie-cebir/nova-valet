import type Stripe from 'stripe';
import type { Queryable } from '@/lib/data/types';
import { confirmPayment, failPayment } from '@/lib/data/payment';
import type { PaymentGateway } from './types';

export type ApplyResult = { applied: boolean; reason?: string };

/**
 * Apply a VERIFIED Stripe event (signature already checked by the route). Only a
 * completed, paid checkout session confirms; expiry/failure releases.
 */
export async function applyStripeEvent(
  db: Queryable,
  event: Stripe.Event,
): Promise<ApplyResult> {
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.payment_status === 'paid') {
      return confirmPayment(db, {
        provider: 'stripe',
        providerPaymentId: s.id,
      });
    }
    return { applied: false, reason: 'not_paid' };
  }
  if (
    event.type === 'checkout.session.expired' ||
    event.type === 'checkout.session.async_payment_failed'
  ) {
    const s = event.data.object as Stripe.Checkout.Session;
    await failPayment(db, { provider: 'stripe', providerPaymentId: s.id });
    return { applied: true, reason: event.type };
  }
  return { applied: false, reason: 'ignored' };
}

/**
 * Handle a Mollie notify. Mollie only sends a payment id — the status is FETCHED
 * from Mollie (never trust the request body). Paid → confirm; terminal failure →
 * release.
 */
export async function applyMollieNotify(
  db: Queryable,
  gateway: PaymentGateway,
  providerPaymentId: string,
): Promise<ApplyResult> {
  const status = await gateway.getStatus(providerPaymentId);
  if (status === 'paid') {
    return confirmPayment(db, { provider: 'mollie', providerPaymentId });
  }
  if (status === 'failed' || status === 'canceled' || status === 'expired') {
    await failPayment(db, { provider: 'mollie', providerPaymentId });
    return { applied: true, reason: status };
  }
  return { applied: false, reason: status };
}
