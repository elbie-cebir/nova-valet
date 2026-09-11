/**
 * Booking domain configuration — ONE source of truth.
 *
 * These are business constants, not secrets. Everything derived (deposit
 * amount, slot boundaries, cutoffs, hold expiry) reads from here so a change
 * lands in exactly one place.
 */

/** Flat, non-refundable deposit taken up front. PLACEHOLDER €25 — client to confirm. */
export const DEPOSIT_AMOUNT_CENTS = 2500;

/** Length of a bookable slot, in hours. */
export const SLOT_LENGTH_HOURS = 2;

/** Free reschedule is only allowed up to this many hours before the slot. */
export const RESCHEDULE_CUTOFF_HOURS = 24;

/** Reminder is sent this many hours before the slot. */
export const REMINDER_LEAD_HOURS = 24;

/** How long a slot hold survives before it expires and the slot is released. */
export const HOLD_TTL_MINUTES = 15;
