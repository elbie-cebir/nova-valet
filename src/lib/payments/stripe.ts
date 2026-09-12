import Stripe from 'stripe';
import type {
  PaymentGateway,
  CreateCheckoutInput,
  CheckoutResult,
  ProviderStatus,
} from './types';

// Lazily constructed so importing this module (e.g. for routing) needs no key.
let client: Stripe | null = null;
function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    client = new Stripe(key);
  }
  return client;
}

/** Stripe adapter — card route. SDK confined to this file. */
export const stripeGateway: PaymentGateway = {
  provider: 'stripe',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: { name: input.description },
            unit_amount: input.amountCents,
          },
        },
      ],
      metadata: {
        reference: input.reference,
        bookingId: input.bookingId,
        kind: input.kind,
      },
      success_url: input.returnUrl,
      cancel_url: input.returnUrl,
    });
    return {
      provider: 'stripe',
      providerPaymentId: session.id,
      checkoutUrl: session.url ?? '',
    };
  },

  async getStatus(id: string): Promise<ProviderStatus> {
    const s = await stripe().checkout.sessions.retrieve(id);
    if (s.payment_status === 'paid') return 'paid';
    if (s.status === 'expired') return 'expired';
    return 'open';
  },
};

/**
 * Verify a Stripe webhook signature and return the parsed event. Throws if the
 * signature doesn't match — the route maps that to a 400. Offline crypto; no
 * network call.
 */
export function verifyStripeEvent(
  rawBody: string,
  signature: string,
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  return stripe().webhooks.constructEvent(rawBody, signature, secret);
}
