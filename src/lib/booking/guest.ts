import type { Queryable } from '@/lib/data/types';
import { resolveBookingByToken } from '@/lib/data/token';
import {
  rescheduleBooking,
  cancelBooking,
  type RescheduleResult,
  type CancelResult,
} from '@/lib/data/booking';

export type GuestRescheduleResult =
  RescheduleResult | { ok: false; reason: 'not_found' };
export type GuestCancelResult =
  CancelResult | { ok: false; reason: 'not_found' };

/**
 * Guest self-service reschedule, TOKEN-SCOPED. The booking id is resolved FROM
 * the token (never taken from the caller), so a guest can only ever move the
 * booking their own magic-link resolves to — an unknown/used/expired/other token
 * fails closed (`not_found`). All the real rules (before-cutoff, confirmed-only,
 * atomic swap, no new deposit, attribution) are B6's `rescheduleBooking`, reused.
 */
export async function rescheduleByToken(
  db: Queryable,
  p: { token: string; newSlotId: string; actor?: string },
): Promise<GuestRescheduleResult> {
  const booking = await resolveBookingByToken(db, p.token);
  if (!booking) return { ok: false, reason: 'not_found' };
  return rescheduleBooking(db, {
    bookingId: booking.id,
    newSlotId: p.newSlotId,
    actor: p.actor ?? 'guest',
  });
}

/**
 * Guest self-service cancel, TOKEN-SCOPED (same fail-closed resolution). Reuses
 * B6's `cancelBooking`: releases the slot, forfeits the non-refundable deposit,
 * records the event.
 */
export async function cancelByToken(
  db: Queryable,
  p: { token: string; actor?: string },
): Promise<GuestCancelResult> {
  const booking = await resolveBookingByToken(db, p.token);
  if (!booking) return { ok: false, reason: 'not_found' };
  return cancelBooking(db, {
    bookingId: booking.id,
    actor: p.actor ?? 'guest',
  });
}
