'use server';

import { z } from 'zod';
import { getDb } from '@/lib/data/db.server';
import { getTravelFee } from '@/lib/content/reads';
import { getAvailableSlots } from '@/lib/data/availability';
import {
  reserveSlot,
  releaseExpiredHolds,
  getTierPrice,
  getAddOnAmounts,
} from '@/lib/data/booking';
import { computeTotals } from '@/lib/booking/pricing';
import { generateReference } from '@/lib/booking/reference';
import { reserveInputSchema } from '@/lib/validation/booking';
import { DEPOSIT_AMOUNT_CENTS, HOLD_TTL_MINUTES } from '@/config/constants';

const postcodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,}$/);

export interface TravelFeeView {
  found: boolean;
  inArea: boolean;
  feeCents: number;
}

/** Look up the travel fee + in/out-of-area for a postcode (step 4). */
export async function lookupTravelFeeAction(
  postcode: string,
): Promise<TravelFeeView> {
  const parsed = postcodeSchema.safeParse(postcode);
  if (!parsed.success) return { found: false, inArea: false, feeCents: 0 };
  const r = await getTravelFee(parsed.data);
  return { found: r.found, inArea: r.inArea, feeCents: r.feeCents };
}

export interface SlotView {
  id: string;
  startAt: string;
  endAt: string;
}

/** Open slots for the next two weeks (step 5). Sweeps expired holds first. */
export async function getUpcomingSlotsAction(): Promise<SlotView[]> {
  const db = await getDb();
  await releaseExpiredHolds(db);
  const from = new Date();
  const to = new Date(from.getTime() + 14 * 24 * 60 * 60 * 1000);
  return getAvailableSlots(db, {
    from: from.toISOString(),
    to: to.toISOString(),
  });
}

export type ReserveActionResult =
  | { ok: true; reference: string }
  | { ok: false; reason: 'invalid' | 'out_of_area' | 'slot_taken' | 'error' };

/**
 * Reserve the slot: re-parse the whole payload, recompute money server-side from
 * DB amounts (never the client's), then atomically hold the slot + create the
 * pending_deposit booking. Returns the reference for the handoff page.
 */
export async function reserveBookingAction(
  input: unknown,
): Promise<ReserveActionResult> {
  const parsed = reserveInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const data = parsed.data;

  const db = await getDb();
  await releaseExpiredHolds(db);

  // Money truth is server-side: look up tier price + add-on + travel amounts.
  const price = await getTierPrice(db, data.serviceId, data.size);
  if (!price) return { ok: false, reason: 'invalid' };

  const addOns = await getAddOnAmounts(db, data.addOnIds);

  const travel = await getTravelFee(data.postcode);
  if (!travel.inArea) return { ok: false, reason: 'out_of_area' };

  const totals = computeTotals({
    tierPriceCents: price.amountCents,
    addOnAmountsCents: addOns.map((a) => a.amountCents),
    travelFeeCents: travel.feeCents,
    depositCents: DEPOSIT_AMOUNT_CENTS,
  });

  // Retry only on the (rare) reference collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await reserveSlot(db, {
      slotId: data.slotId,
      serviceId: data.serviceId,
      tierId: price.tierId,
      customerName: data.name,
      customerPhone: data.phone,
      customerEmail: data.email,
      address: data.address,
      postcode: data.postcode,
      locale: parsedLocale(data),
      reference: generateReference(),
      travelFeeCents: totals.travelFeeCents,
      subtotalCents: totals.subtotalCents,
      totalCents: totals.totalCents,
      depositCents: totals.depositCents,
      balanceCents: totals.balanceCents,
      addOns,
      holdTtlMinutes: HOLD_TTL_MINUTES,
    });
    if (result.ok) return { ok: true, reference: result.reference };
    if (result.reason === 'slot_unavailable')
      return { ok: false, reason: 'slot_taken' };
    // reference_collision → try a new reference
  }
  return { ok: false, reason: 'error' };
}

// Locale is passed alongside the payload by the client; default nl.
function parsedLocale(data: { locale?: string }): string {
  return data.locale === 'en' || data.locale === 'fr' ? data.locale : 'nl';
}
