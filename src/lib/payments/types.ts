/**
 * The PaymentGateway seam: ONE interface, two adapters (Mollie, Stripe),
 * selected by the method the customer picks (ADR-013). Provider SDKs are
 * confined to their adapter — booking logic never imports a provider.
 */
export type PaymentMethod = 'bancontact' | 'card';
export type PaymentProvider = 'mollie' | 'stripe';
export type PaymentKind = 'deposit' | 'balance';

/** Normalised provider status. Money truth is the provider, not the client. */
export type ProviderStatus =
  'paid' | 'open' | 'pending' | 'failed' | 'canceled' | 'expired';

export interface CreateCheckoutInput {
  kind: PaymentKind;
  method: PaymentMethod;
  amountCents: number;
  currency: string;
  reference: string;
  bookingId: string;
  description: string;
  /** Where the provider returns the customer after checkout. */
  returnUrl: string;
  /** Where the provider notifies us (Mollie requires it; Stripe ignores it). */
  webhookUrl: string;
}

export interface CheckoutResult {
  provider: PaymentProvider;
  providerPaymentId: string;
  checkoutUrl: string;
}

export interface PaymentGateway {
  readonly provider: PaymentProvider;
  /** Create a hosted checkout and return where to send the customer. */
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult>;
  /** Fetch the authoritative payment status from the provider. */
  getStatus(providerPaymentId: string): Promise<ProviderStatus>;
}
