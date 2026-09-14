import type { Queryable } from '@/lib/data/types';
import { resolveBookingByToken } from '@/lib/data/token';
import {
  rescheduleBooking,
  cancelBooking,
  type RescheduleResult,
  type CancelResult,
} from '@/lib/data/booking';
import { createGuestReview } from '@/lib/data/reviews';

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

export type GuestReviewResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'not_allowed' | 'already_reviewed' };

/**
 * Guest "rate your service", TOKEN-SCOPED. Only a FULLY-PAID booking can be
 * rated (deposit + balance settled), and only once. The author is the booking's
 * own customer name; the review is created UNPUBLISHED for owner approval. Fails
 * closed on an unknown token.
 */
export async function reviewByToken(
  db: Queryable,
  p: { token: string; rating: number; body: string },
): Promise<GuestReviewResult> {
  const booking = await resolveBookingByToken(db, p.token);
  if (!booking) return { ok: false, reason: 'not_found' };

  const settled = booking.balancePaidAt !== null || booking.balanceCents === 0;
  const fullyPaid =
    (booking.status === 'confirmed' || booking.status === 'completed') &&
    booking.depositPaidAt !== null &&
    settled;
  if (!fullyPaid) return { ok: false, reason: 'not_allowed' };

  const result = await createGuestReview(db, {
    bookingId: booking.id,
    authorName: booking.customerName,
    body: p.body,
    rating: p.rating,
  });
  return result === 'created'
    ? { ok: true }
    : { ok: false, reason: 'already_reviewed' };
}
