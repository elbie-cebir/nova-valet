import type Stripe from 'stripe';
import type { Queryable } from '@/lib/data/types';
import { confirmPayment, failPayment } from '@/lib/data/payment';
import { onDepositConfirmed } from '@/lib/notifications/booking';
import type { PaymentGateway } from './types';

export type ApplyResult = { applied: boolean; reason?: string };

/** Confirm + (for a verified deposit) send the confirmation email with the link. */
async function confirmAndNotify(
  db: Queryable,
  id: { provider: 'stripe' | 'mollie'; providerPaymentId: string },
): Promise<ApplyResult> {
  const r = await confirmPayment(db, id);
  if (r.applied && r.kind === 'deposit' && r.bookingId) {
    // A confirmation-email failure must never break the (already-verified)
    // payment confirmation — the booking is confirmed regardless. Log + move on.
    try {
      await onDepositConfirmed(db, r.bookingId);
    } catch (e) {
      console.error('[confirm] confirmation email failed:', e);
    }
  }
  return { applied: r.applied, reason: r.reason };
}

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
      return confirmAndNotify(db, {
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
    return confirmAndNotify(db, { provider: 'mollie', providerPaymentId });
  }
  if (status === 'failed' || status === 'canceled' || status === 'expired') {
    await failPayment(db, { provider: 'mollie', providerPaymentId });
    return { applied: true, reason: status };
  }
  return { applied: false, reason: status };
}
