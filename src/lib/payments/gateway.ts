import { stripeGateway } from './stripe';
import { mollieGateway } from './mollie';
import type { PaymentGateway, PaymentMethod, PaymentProvider } from './types';

/** Bancontact → Mollie, card → Stripe (ADR-013). */
export function providerFor(method: PaymentMethod): PaymentProvider {
  return method === 'card' ? 'stripe' : 'mollie';
}

export function gatewayFor(method: PaymentMethod): PaymentGateway {
  return method === 'card' ? stripeGateway : mollieGateway;
}

export function gatewayForProvider(provider: PaymentProvider): PaymentGateway {
  return provider === 'stripe' ? stripeGateway : mollieGateway;
}
