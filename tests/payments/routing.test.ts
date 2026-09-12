import { describe, it, expect } from 'vitest';
import { providerFor, gatewayFor } from '@/lib/payments/gateway';

describe('payment method routing (ADR-013)', () => {
  it('routes bancontact → Mollie and card → Stripe', () => {
    expect(providerFor('bancontact')).toBe('mollie');
    expect(providerFor('card')).toBe('stripe');
    expect(gatewayFor('bancontact').provider).toBe('mollie');
    expect(gatewayFor('card').provider).toBe('stripe');
  });
});
