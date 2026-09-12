/**
 * Booking domain configuration — ONE source of truth.
 *
 * These are business constants, not secrets. Everything derived (deposit
 * amount, slot boundaries, cutoffs, hold expiry) reads from here so a change
 * lands in exactly one place.
 */

/**
 * The business timezone. All slot/appointment wall-clock times are displayed in
 * this zone regardless of the viewer's browser; timestamps are stored in UTC.
 * (ADR-015)
 */
export const BUSINESS_TIMEZONE = 'Europe/Brussels';

/** Flat, non-refundable deposit taken up front. PLACEHOLDER €25 — client to confirm. */
export const DEPOSIT_AMOUNT_CENTS = 2500;

/** Length of a bookable slot, in hours. */
export const SLOT_LENGTH_HOURS = 2;

/**
 * Travel buffer the owner needs between appointments. A new slot must sit at
 * least this many hours (edge to edge) from any other slot, so back-to-back
 * jobs always leave time to drive. (ADR-015)
 */
export const TRAVEL_BUFFER_HOURS = 1;

/** Page size for the owner bookings list — every admin read is bounded. */
export const ADMIN_PAGE_SIZE = 20;

/** Free reschedule is only allowed up to this many hours before the slot. */
export const RESCHEDULE_CUTOFF_HOURS = 24;

/** Reminder is sent this many hours before the slot. */
export const REMINDER_LEAD_HOURS = 24;

/** How long a slot hold survives before it expires and the slot is released. */
export const HOLD_TTL_MINUTES = 15;
