import type {
  PaymentGateway,
  CreateCheckoutInput,
  CheckoutResult,
  ProviderStatus,
} from './types';

const API = 'https://api.mollie.com/v2';

function apiKey(): string {
  const k = process.env.MOLLIE_API_KEY;
  if (!k) throw new Error('MOLLIE_API_KEY is not set');
  return k;
}

async function mollie<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Mollie API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

interface MolliePayment {
  id: string;
  status: string;
  _links: { checkout?: { href: string } };
}

/** Mollie adapter — Bancontact route. Talks to Mollie's REST API directly. */
export const mollieGateway: PaymentGateway = {
  provider: 'mollie',

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    const p = await mollie<MolliePayment>('/payments', {
      method: 'POST',
      body: JSON.stringify({
        amount: {
          currency: input.currency,
          value: (input.amountCents / 100).toFixed(2),
        },
        description: input.description,
        redirectUrl: input.returnUrl,
        webhookUrl: input.webhookUrl,
        method: 'bancontact',
        metadata: {
          reference: input.reference,
          bookingId: input.bookingId,
          kind: input.kind,
        },
      }),
    });
    return {
      provider: 'mollie',
      providerPaymentId: p.id,
      checkoutUrl: p._links.checkout?.href ?? '',
    };
  },

  async getStatus(id: string): Promise<ProviderStatus> {
    const p = await mollie<MolliePayment>(`/payments/${id}`);
    // Mollie statuses map 1:1 to our normalised set.
    return p.status as ProviderStatus;
  },
};
