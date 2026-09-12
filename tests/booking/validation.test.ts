import { describe, it, expect } from 'vitest';
import {
  locationStepSchema,
  contactStepSchema,
  reserveInputSchema,
} from '@/lib/validation/booking';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('booking step validation (parse, don’t trust)', () => {
  it('location: rejects a bad postcode and short address', () => {
    expect(
      locationStepSchema.safeParse({ address: '1 Main St', postcode: '1000' })
        .success,
    ).toBe(true);
    expect(
      locationStepSchema.safeParse({ address: '1 Main St', postcode: 'abc' })
        .success,
    ).toBe(false);
    expect(
      locationStepSchema.safeParse({ address: 'x', postcode: '1000' }).success,
    ).toBe(false);
  });

  it('contact: requires a valid email and explicit agreement', () => {
    const ok = contactStepSchema.safeParse({
      name: 'Guest',
      phone: '+32470000000',
      email: 'guest@example.com',
      agree: true,
    });
    expect(ok.success).toBe(true);

    expect(
      contactStepSchema.safeParse({
        name: 'Guest',
        phone: '+32470000000',
        email: 'not-an-email',
        agree: true,
      }).success,
    ).toBe(false);

    expect(
      contactStepSchema.safeParse({
        name: 'Guest',
        phone: '+32470000000',
        email: 'guest@example.com',
        agree: false,
      }).success,
    ).toBe(false);
  });

  it('reserve payload: rejects a non-uuid service and accepts a full valid payload', () => {
    const good = reserveInputSchema.safeParse({
      serviceId: UUID,
      size: 'medium',
      addOnIds: [],
      address: '1 Main St',
      postcode: '1000',
      notes: '',
      slotId: UUID,
      name: 'Guest',
      phone: '+32470000000',
      email: 'guest@example.com',
      agree: true,
    });
    expect(good.success).toBe(true);

    const bad = reserveInputSchema.safeParse({
      serviceId: 'not-a-uuid',
      size: 'medium',
      addOnIds: [],
      address: '1 Main St',
      postcode: '1000',
      slotId: UUID,
      name: 'Guest',
      phone: '+32470000000',
      email: 'guest@example.com',
      agree: true,
    });
    expect(bad.success).toBe(false);

    expect(
      reserveInputSchema.safeParse({
        serviceId: UUID,
        size: 'spaceship',
        addOnIds: [],
        address: '1 Main St',
        postcode: '1000',
        slotId: UUID,
        name: 'Guest',
        phone: '+32470000000',
        email: 'guest@example.com',
        agree: true,
      }).success,
    ).toBe(false);
  });
});
