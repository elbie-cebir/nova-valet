import type { Queryable } from './types';

export interface OpenSlot {
  id: string;
  startAt: string;
  endAt: string;
}

/**
 * Open slots whose start falls in the half-open range [from, to).
 *
 * Only `status = 'open'` is returned: held and booked slots are excluded, so a
 * customer can never be offered a slot that is already taken or mid-checkout.
 * This is a read; the reserve-then-confirm transition lands in B3.
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
