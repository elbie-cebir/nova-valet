import { describe, it, expect } from 'vitest';
import { computeTotals } from '@/lib/booking/pricing';

describe('booking totals', () => {
  it('subtotal = tier price + add-ons; total adds travel; balance = total - deposit', () => {
    const t = computeTotals({
      tierPriceCents: 14000,
      addOnAmountsCents: [2000, 3000],
      travelFeeCents: 1500,
      depositCents: 2500,
    });
    expect(t.subtotalCents).toBe(19000); // 14000 + 2000 + 3000
    expect(t.travelFeeCents).toBe(1500);
    expect(t.totalCents).toBe(20500); // 19000 + 1500
    expect(t.depositCents).toBe(2500);
    expect(t.balanceCents).toBe(18000); // 20500 - 2500
  });

  it('handles no add-ons and zero travel fee', () => {
    const t = computeTotals({
      tierPriceCents: 3000,
      addOnAmountsCents: [],
      travelFeeCents: 0,
      depositCents: 2500,
    });
    expect(t.subtotalCents).toBe(3000);
    expect(t.totalCents).toBe(3000);
    expect(t.balanceCents).toBe(500);
  });

  it('clamps deposit to total so balance is never negative', () => {
    const t = computeTotals({
      tierPriceCents: 1000,
      addOnAmountsCents: [],
      travelFeeCents: 0,
      depositCents: 2500,
    });
    expect(t.totalCents).toBe(1000);
    expect(t.depositCents).toBe(1000);
    expect(t.balanceCents).toBe(0);
  });
});
