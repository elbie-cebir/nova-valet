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
import { getDepositCents } from '@/lib/data/settings';
import {
  autocompleteAddress,
  type AddressSuggestion,
} from '@/lib/geo/geoapify';
import { HOLD_TTL_MINUTES } from '@/config/constants';

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

const suggestSchema = z.object({
  query: z.string().trim().min(3).max(120),
  postcode: z
    .string()
    .trim()
    .regex(/^\d{4,}$/),
});

/**
 * Address autocomplete (step 4). Proxies Geoapify SERVER-SIDE so the key never
 * reaches the browser; requires ≥3 chars + a valid postcode, returns ≤5 Belgian
 * suggestions filtered to that postcode. The client debounces before calling.
 */
export async function addressSuggestAction(
  input: unknown,
): Promise<{ suggestions: AddressSuggestion[] }> {
  const parsed = suggestSchema.safeParse(input);
  if (!parsed.success) return { suggestions: [] };
  const suggestions = await autocompleteAddress(parsed.data);
  return { suggestions };
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

  const depositCents = await getDepositCents(db);
  const totals = computeTotals({
    tierPriceCents: price.amountCents,
    addOnAmountsCents: addOns.map((a) => a.amountCents),
    travelFeeCents: travel.feeCents,
    depositCents,
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
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      formattedAddress: data.formattedAddress ?? null,
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
