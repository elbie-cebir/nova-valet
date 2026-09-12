/**
 * Booking money maths — pure, integer cents, one place.
 *
 * subtotal = service-at-tier price + every chosen add-on
 * total    = subtotal + travel fee
 * deposit  = the flat deposit (clamped to total so balance is never negative)
 * balance  = total − deposit
 *
 * The payment provider remains the source of truth for money (ADR-013); these
 * are the booking's locked figures at reserve time, computed server-side from
 * DB amounts — never from client input.
 */
export interface TotalsInput {
  tierPriceCents: number;
  addOnAmountsCents: number[];
  travelFeeCents: number;
  depositCents: number;
}

export interface Totals {
  subtotalCents: number;
  travelFeeCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
}

export function computeTotals(input: TotalsInput): Totals {
  const addOnsTotal = input.addOnAmountsCents.reduce((a, b) => a + b, 0);
  const subtotalCents = input.tierPriceCents + addOnsTotal;
  const totalCents = subtotalCents + input.travelFeeCents;
  // Flat deposit, but never more than the total (keeps balance >= 0 and
  // satisfies the DB CHECK constraints).
  const depositCents = Math.min(input.depositCents, totalCents);
  const balanceCents = totalCents - depositCents;
  return {
    subtotalCents,
    travelFeeCents: input.travelFeeCents,
    totalCents,
    depositCents,
    balanceCents,
  };
}
