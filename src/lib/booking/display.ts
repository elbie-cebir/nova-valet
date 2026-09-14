/**
 * Derive a booking's *display* state for the customer + admin views, so the
 * status pill and the offered actions stay consistent. Raw DB status alone
 * ("confirmed") can't distinguish an upcoming job from one that's fully paid or
 * already in the past — this collapses those into a single source of truth.
 */
export interface DisplayInput {
  status: string;
  slotStartAt: string;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  balanceCents: number;
}

export interface DisplayState {
  /** Key into the `Statuses` message namespace for the pill label. */
  statusKey: string;
  isPast: boolean;
  fullyPaid: boolean;
  completed: boolean;
  dead: boolean;
}

export function bookingDisplay(b: DisplayInput, nowMs: number): DisplayState {
  const isPast = new Date(b.slotStartAt).getTime() < nowMs;
  const dead = b.status === 'cancelled' || b.status === 'expired';
  const fullyPaid =
    (b.status === 'confirmed' || b.status === 'completed') &&
    b.depositPaidAt !== null &&
    (b.balancePaidAt !== null || b.balanceCents === 0);
  // A confirmed booking whose slot has passed reads as completed to the user.
  const completed =
    b.status === 'completed' || (b.status === 'confirmed' && isPast);

  let statusKey: string;
  if (dead)
    statusKey = b.status; // cancelled | expired
  else if (completed) statusKey = 'completed';
  else if (b.status === 'pending_deposit') statusKey = 'pending_deposit';
  else if (fullyPaid) statusKey = 'fully_paid';
  else statusKey = 'confirmed';

  return { statusKey, isPast, fullyPaid, completed, dead };
}
