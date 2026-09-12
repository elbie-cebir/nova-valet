import type { Queryable } from './types';
import { SLOT_LENGTH_HOURS, TRAVEL_BUFFER_HOURS } from '@/config/constants';

export interface AdminSlot {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  closed: boolean;
  bookingReference: string | null;
}

export type CreateSlotResult =
  | { ok: true; slotId: string; startAt: string; endAt: string }
  | { ok: false; reason: 'invalid_start' | 'overlap' };

/**
 * Create a bookable slot the owner has opened. The slot is a fixed
 * `SLOT_LENGTH_HOURS` block — the end is derived from the start, never trusted
 * from the caller. A new slot must clear every other working slot by at least
 * the travel buffer on both sides (ADR-015), enforced inside the transaction so
 * a concurrent create can't sneak a too-close slot past the check.
 *
 * Closed slots don't reserve travel time, so they're ignored by the buffer.
 */
export async function createSlot(
  db: Queryable,
  p: { startAt: string },
): Promise<CreateSlotResult> {
  const start = new Date(p.startAt);
  if (Number.isNaN(start.getTime()))
    return { ok: false, reason: 'invalid_start' };
  const end = new Date(start.getTime() + SLOT_LENGTH_HOURS * 3_600_000);

  const startIso = start.toISOString();
  const endIso = end.toISOString();

  await db.query('begin');
  try {
    const clash = await db.query(
      `select 1 from slot
       where not closed
         and status in ('open', 'held', 'booked')
         and end_at   > $1::timestamptz - make_interval(hours => $3)
         and start_at < $2::timestamptz + make_interval(hours => $3)
       limit 1`,
      [startIso, endIso, TRAVEL_BUFFER_HOURS],
    );
    if (clash.rows.length > 0) {
      await db.query('rollback');
      return { ok: false, reason: 'overlap' };
    }

    const ins = await db.query<{ id: string }>(
      `insert into slot (start_at, end_at, status)
       values ($1, $2, 'open') returning id`,
      [startIso, endIso],
    );
    await db.query('commit');
    return {
      ok: true,
      slotId: ins.rows[0].id,
      startAt: startIso,
      endAt: endIso,
    };
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}

export type SetClosedResult =
  { ok: true } | { ok: false; reason: 'not_found' | 'in_use' };

/**
 * Close (make unbookable) or re-open a slot. A slot can only be CLOSED while it
 * is genuinely free (`status = 'open'`) — a held or booked slot can't be pulled
 * out from under a customer. Re-opening just clears the flag.
 */
export async function setSlotClosed(
  db: Queryable,
  slotId: string,
  closed: boolean,
): Promise<SetClosedResult> {
  if (closed) {
    const upd = await db.query<{ id: string }>(
      `update slot set closed = true
       where id = $1 and status = 'open' and not closed
       returning id`,
      [slotId],
    );
    if (upd.rows.length > 0) return { ok: true };
    // Distinguish "doesn't exist" from "can't close because it's in use".
    const exists = await db.query(
      `select status, closed from slot where id = $1`,
      [slotId],
    );
    if (exists.rows.length === 0) return { ok: false, reason: 'not_found' };
    return { ok: false, reason: 'in_use' };
  }

  const upd = await db.query<{ id: string }>(
    `update slot set closed = false where id = $1 returning id`,
    [slotId],
  );
  return upd.rows.length > 0
    ? { ok: true }
    : { ok: false, reason: 'not_found' };
}

/** Every slot whose start falls in [from, to), with its booking ref if booked. */
export async function listSlots(
  db: Queryable,
  range: { from: string; to: string },
): Promise<AdminSlot[]> {
  const { rows } = await db.query<{
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    closed: boolean;
    booking_reference: string | null;
  }>(
    `select s.id, s.start_at, s.end_at, s.status, s.closed,
            b.reference as booking_reference
     from slot s
     left join booking b on b.id = s.booking_id
     where s.start_at >= $1 and s.start_at < $2
     order by s.start_at asc`,
    [range.from, range.to],
  );
  return rows.map((r) => ({
    id: r.id,
    startAt: new Date(r.start_at).toISOString(),
    endAt: new Date(r.end_at).toISOString(),
    status: r.status,
    closed: r.closed,
    bookingReference: r.booking_reference,
  }));
}
