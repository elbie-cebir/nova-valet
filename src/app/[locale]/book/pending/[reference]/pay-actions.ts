'use server';

import { z } from 'zod';
import { getDb } from '@/lib/data/db.server';
import { getBookingByReference } from '@/lib/data/booking';
import { recordInitiatedPayment, findOpenPayment } from '@/lib/data/payment';
import { issueMagicLink } from '@/lib/data/token';
import { gatewayFor, providerFor } from '@/lib/payments/gateway';
import { siteUrl, bookingUrl } from '@/lib/url';

const inputSchema = z.object({
  reference: z.string().trim().min(1),
  method: z.enum(['bancontact', 'card']),
  kind: z.enum(['deposit', 'balance']),
  locale: z.enum(['nl', 'en', 'fr']),
  // The current guest-view token, when paying from there (balance). When absent
  // (deposit from the checkout page) a fresh magic link is minted so the return
  // lands on the token-scoped guest view.
  token: z.string().trim().optional(),
});

export type StartPaymentResult =
  | { ok: true; checkoutUrl: string }
  | {
      ok: false;
      reason: 'invalid' | 'not_found' | 'bad_state' | 'provider_error';
    };

/**
 * Start a deposit or balance payment: pick the provider by method, create the
 * hosted checkout, record the payment row (open), and return the checkout URL
 * for the client to redirect to. Amounts come from the booking (server-side),
 * never the client.
 */
export async function startPaymentAction(
  input: unknown,
): Promise<StartPaymentResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const { reference, method, kind, locale, token } = parsed.data;

  const db = await getDb();
  const booking = await getBookingByReference(db, reference);
  if (!booking) return { ok: false, reason: 'not_found' };

  if (kind === 'deposit' && booking.status !== 'pending_deposit') {
    return { ok: false, reason: 'bad_state' };
  }
  if (
    kind === 'balance' &&
    !(
      booking.status === 'confirmed' &&
      booking.balancePaidAt === null &&
      booking.balanceCents > 0
    )
  ) {
    return { ok: false, reason: 'bad_state' };
  }

  // Double-payment guard: if a checkout is already open for this booking + kind,
  // reuse it instead of creating a second one (double-click, refresh, 2nd tab).
  const existing = await findOpenPayment(db, booking.id, kind);
  if (existing) {
    return { ok: true, checkoutUrl: existing.checkoutUrl };
  }

  const provider = providerFor(method);
  const gateway = gatewayFor(method);
  const amountCents =
    kind === 'deposit' ? booking.depositCents : booking.balanceCents;

  // Return to the token-scoped guest view: reuse the current token (balance) or
  // mint a fresh magic link (deposit) so the customer lands on their booking.
  const returnToken = token ?? (await issueMagicLink(db, booking.id, 90));

  try {
    const checkout = await gateway.createCheckout({
      kind,
      method,
      amountCents,
      currency: 'EUR',
      reference: booking.reference,
      bookingId: booking.id,
      description: `Nova Valet ${kind} · ${booking.reference}`,
      returnUrl: bookingUrl(locale, returnToken),
      webhookUrl: `${siteUrl()}/api/webhooks/${provider}`,
    });
    await recordInitiatedPayment(db, {
      bookingId: booking.id,
      kind,
      provider,
      method,
      providerPaymentId: checkout.providerPaymentId,
      amountCents,
      status: 'open',
      checkoutUrl: checkout.checkoutUrl,
    });
    return { ok: true, checkoutUrl: checkout.checkoutUrl };
  } catch {
    return { ok: false, reason: 'provider_error' };
  }
}
