import type { Queryable } from './types';

export interface OpenSlot {
  id: string;
  startAt: string;
  endAt: string;
}

/**
 * Open slots whose start falls in the half-open range [from, to).
 *
 * Only `status = 'open'` AND not owner-closed is returned: held, booked and
 * closed slots are excluded, so a customer can never be offered a slot that is
 * already taken, mid-checkout, or that the owner has taken off the calendar.
 *
 * `from`/`to` are ISO timestamps.
 */
export async function getAvailableSlots(
  db: Queryable,
  range: { from: string; to: string },
): Promise<OpenSlot[]> {
  const { rows } = await db.query<{
    id: string;
    start_at: string;
    end_at: string;
  }>(
    `select id, start_at, end_at
     from slot
     where status = 'open'
       and not closed
       and start_at >= $1
       and start_at < $2
     order by start_at asc`,
    [range.from, range.to],
  );
  return rows.map((r) => ({
    id: r.id,
    startAt: new Date(r.start_at).toISOString(),
    endAt: new Date(r.end_at).toISOString(),
  }));
}
