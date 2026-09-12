import type { Queryable } from './types';

/**
 * Confirmed bookings whose slot starts within the next `withinHours` and that
 * haven't had a reminder sent yet. The reminder window is future-only (slot
 * start_at > now) so past slots are never reminded.
 */
export async function findBookingsDueForReminder(
  db: Queryable,
  withinHours: number,
): Promise<{ id: string }[]> {
  const { rows } = await db.query<{ id: string }>(
    `select b.id
     from booking b
     join slot sl on sl.id = b.slot_id
     where b.status = 'confirmed'
       and b.reminder_sent_at is null
       and sl.start_at > now()
       and sl.start_at <= now() + make_interval(hours => $1)
     order by sl.start_at asc`,
    [withinHours],
  );
  return rows.map((r) => ({ id: r.id }));
}

/**
 * Atomically claim a booking's reminder: set `reminder_sent_at` only if still
 * null, returning whether THIS call won the claim. Two concurrent cron runs can
 * both call it; exactly one gets `true`, so the reminder is never double-sent.
 */
export async function claimReminder(
  db: Queryable,
  bookingId: string,
): Promise<boolean> {
  const { rows } = await db.query<{ id: string }>(
    `update booking set reminder_sent_at = now()
     where id = $1 and reminder_sent_at is null
     returning id`,
    [bookingId],
  );
  return rows.length > 0;
}
