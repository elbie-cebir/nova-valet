import type { Queryable } from './types';
import { RESCHEDULE_CUTOFF_HOURS } from '@/config/constants';

/** Resolve a service + size-tier to its priced tier id and amount. */
export async function getTierPrice(
  db: Queryable,
  serviceId: string,
  sizeKey: string,
): Promise<{ tierId: string; amountCents: number; currency: string } | null> {
  const { rows } = await db.query<{
    tier_id: string;
    amount_cents: number;
    currency: string;
  }>(
    `select t.id as tier_id, p.amount_cents, p.currency
     from price p
     join vehicle_size_tier t on t.id = p.vehicle_size_tier_id
     where p.service_id = $1 and t.key = $2`,
    [serviceId, sizeKey],
  );
  const r = rows[0];
  return r
    ? {
        tierId: r.tier_id,
        amountCents: Number(r.amount_cents),
        currency: r.currency,
      }
    : null;
}

/** Snapshot amounts for the chosen active add-ons (unknown/inactive ids dropped). */
export async function getAddOnAmounts(
  db: Queryable,
  addOnIds: string[],
): Promise<{ id: string; amountCents: number }[]> {
  if (addOnIds.length === 0) return [];
  const placeholders = addOnIds.map((_, i) => `$${i + 1}`).join(',');
  const { rows } = await db.query<{ id: string; amount_cents: number }>(
    `select id, amount_cents from add_on
     where active and id in (${placeholders})`,
    addOnIds,
  );
  return rows.map((r) => ({ id: r.id, amountCents: Number(r.amount_cents) }));
}

/**
 * Release every expired hold: the hold's booking becomes `expired` and the slot
 * returns to `open`. This is what makes "released on abandon or expiry" true and
 * lets a slot whose hold lapsed be booked again. Idempotent; safe to call before
 * any availability read or reserve.
 */
export async function releaseExpiredHolds(db: Queryable): Promise<number> {
  await db.query('begin');
  try {
    await db.query(
      `update booking set status = 'expired'
       where status = 'pending_deposit'
         and slot_id in (
           select id from slot where status = 'held' and held_until < now()
         )`,
    );
    const freed = await db.query(
      `update slot set status = 'open', booking_id = null, held_until = null
       where status = 'held' and held_until < now()
       returning id`,
    );
    await db.query('commit');
    return freed.rows.length;
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}

export interface ReserveParams {
  slotId: string;
  serviceId: string;
  tierId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  postcode: string;
  locale: string;
  reference: string;
  travelFeeCents: number;
  subtotalCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
  addOns: { id: string; amountCents: number }[];
  holdTtlMinutes: number;
}

export type ReserveResult =
  | { ok: true; bookingId: string; reference: string; heldUntil: string }
  | { ok: false; reason: 'slot_unavailable' | 'reference_collision' };

function uniqueConstraint(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (/booking_one_active_per_slot/.test(msg))
    return 'booking_one_active_per_slot';
  if (/reference/.test(msg) && /unique|duplicate/i.test(msg))
    return 'reference';
  if (/duplicate key|unique/i.test(msg)) return 'other_unique';
  return null;
}

/**
 * Reserve-then-confirm, step one: atomically create the booking as
 * `pending_deposit` and move its slot `open → held` with a TTL, tied to the
 * booking. Confirmation happens later on a provider-verified deposit (B4).
 *
 * Atomicity + safety:
 *  - Runs in a transaction.
 *  - First sweeps THIS slot if its own hold has expired (frees it, expires the
 *    stale booking), so a lapsed hold no longer blocks a new booking.
 *  - Claims the slot with `... where status = 'open'`; the row lock serialises
 *    concurrent reservers — the loser sees `held` and gets 0 rows.
 *  - The partial unique index `booking_one_active_per_slot` is the DB-level
 *    backstop: a second active booking on one slot is impossible even if two
 *    transactions somehow raced the claim.
 */
export async function reserveSlot(
  db: Queryable,
  p: ReserveParams,
): Promise<ReserveResult> {
  await db.query('begin');
  try {
    // 1. Sweep this slot's own expired hold.
    await db.query(
      `update booking set status = 'expired'
       where slot_id = $1 and status = 'pending_deposit'
         and exists (
           select 1 from slot s
           where s.id = $1 and s.status = 'held' and s.held_until < now()
         )`,
      [p.slotId],
    );
    await db.query(
      `update slot set status = 'open', booking_id = null, held_until = null
       where id = $1 and status = 'held' and held_until < now()`,
      [p.slotId],
    );

    // 2. Claim the slot (only if genuinely open). Serialised by the row lock.
    const claim = await db.query<{ held_until: string }>(
      `update slot
       set status = 'held', held_until = now() + make_interval(mins => $2)
       where id = $1 and status = 'open'
       returning held_until`,
      [p.slotId, p.holdTtlMinutes],
    );
    if (claim.rows.length === 0) {
      await db.query('rollback');
      return { ok: false, reason: 'slot_unavailable' };
    }
    const heldUntil = claim.rows[0].held_until;

    // 3. Create the booking (unique index is the backstop against double-book).
    const ins = await db.query<{ id: string }>(
      `insert into booking (
         reference, status, service_id, vehicle_size_tier_id, slot_id,
         customer_name, customer_phone, customer_email, address, postcode,
         travel_fee_cents, subtotal_cents, total_cents, deposit_cents,
         balance_cents, locale, latitude, longitude, formatted_address
       ) values (
         $1, 'pending_deposit', $2, $3, $4,
         $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15, $16, $17, $18
       ) returning id`,
      [
        p.reference,
        p.serviceId,
        p.tierId,
        p.slotId,
        p.customerName,
        p.customerPhone,
        p.customerEmail,
        p.address,
        p.postcode,
        p.travelFeeCents,
        p.subtotalCents,
        p.totalCents,
        p.depositCents,
        p.balanceCents,
        p.locale,
        p.latitude ?? null,
        p.longitude ?? null,
        p.formattedAddress ?? null,
      ],
    );
    const bookingId = ins.rows[0].id;

    // 4. Snapshot add-ons (bounded set, single multi-row insert).
    if (p.addOns.length > 0) {
      const values: string[] = [];
      const params: unknown[] = [];
      p.addOns.forEach((a, i) => {
        const base = i * 3;
        values.push(`($${base + 1}, $${base + 2}, $${base + 3})`);
        params.push(bookingId, a.id, a.amountCents);
      });
      await db.query(
        `insert into booking_add_on (booking_id, add_on_id, amount_cents)
         values ${values.join(',')}`,
        params,
      );
    }

    // 5. Link the slot back to its booking.
    await db.query(`update slot set booking_id = $2 where id = $1`, [
      p.slotId,
      bookingId,
    ]);

    await db.query('commit');
    return {
      ok: true,
      bookingId,
      reference: p.reference,
      heldUntil: new Date(heldUntil).toISOString(),
    };
  } catch (e) {
    await db.query('rollback');
    const c = uniqueConstraint(e);
    if (c === 'reference') return { ok: false, reason: 'reference_collision' };
    if (c) return { ok: false, reason: 'slot_unavailable' };
    throw e;
  }
}

export interface BookingSummary {
  id: string;
  reference: string;
  status: string;
  locale: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceKey: string;
  serviceName: string;
  tierKey: string;
  tierLabel: string;
  slotId: string;
  slotStartAt: string;
  slotEndAt: string;
  address: string;
  postcode: string;
  travelFeeCents: number;
  subtotalCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  heldUntil: string | null;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  addOns: { name: string; amountCents: number }[];
}

/** Minimal contact info for sending the confirmation email. */
export async function getBookingContact(
  db: Queryable,
  bookingId: string,
): Promise<{ email: string; locale: string; reference: string } | null> {
  const { rows } = await db.query<{
    customer_email: string;
    locale: string;
    reference: string;
  }>(`select customer_email, locale, reference from booking where id = $1`, [
    bookingId,
  ]);
  const r = rows[0];
  return r
    ? { email: r.customer_email, locale: r.locale, reference: r.reference }
    : null;
}

/** Read a booking (with joined display keys) by its human reference. */
export async function getBookingByReference(
  db: Queryable,
  reference: string,
): Promise<BookingSummary | null> {
  const { rows } = await db.query<Record<string, unknown>>(
    `select b.id, b.reference, b.status, b.locale,
            b.customer_name, b.customer_phone, b.customer_email,
            s.key as service_key,
            case when b.locale='en' then s.name_en
                 when b.locale='fr' then s.name_fr else s.name_nl end as service_name,
            t.key as tier_key,
            case when b.locale='en' then t.label_en
                 when b.locale='fr' then t.label_fr else t.label_nl end as tier_label,
            b.slot_id,
            sl.start_at as slot_start_at, sl.end_at as slot_end_at,
            sl.held_until,
            b.address, b.postcode, b.travel_fee_cents, b.subtotal_cents,
            b.total_cents, b.deposit_cents, b.balance_cents,
            b.deposit_paid_at, b.balance_paid_at,
            b.latitude, b.longitude, b.formatted_address
     from booking b
     join service s on s.id = b.service_id
     join vehicle_size_tier t on t.id = b.vehicle_size_tier_id
     join slot sl on sl.id = b.slot_id
     where b.reference = $1`,
    [reference],
  );
  const r = rows[0];
  if (!r) return null;

  const addOns = await db.query<{ name: string; amount_cents: number }>(
    `select case when $2='en' then a.name_en
                 when $2='fr' then a.name_fr else a.name_nl end as name,
            ba.amount_cents
     from booking_add_on ba
     join add_on a on a.id = ba.add_on_id
     where ba.booking_id = $1
     order by ba.amount_cents asc`,
    [r.id as string, r.locale as string],
  );

  return {
    id: r.id as string,
    reference: r.reference as string,
    status: r.status as string,
    locale: r.locale as string,
    customerName: r.customer_name as string,
    customerPhone: r.customer_phone as string,
    customerEmail: r.customer_email as string,
    serviceKey: r.service_key as string,
    serviceName: r.service_name as string,
    tierKey: r.tier_key as string,
    tierLabel: r.tier_label as string,
    slotId: r.slot_id as string,
    slotStartAt: new Date(r.slot_start_at as string).toISOString(),
    slotEndAt: new Date(r.slot_end_at as string).toISOString(),
    address: r.address as string,
    postcode: r.postcode as string,
    travelFeeCents: Number(r.travel_fee_cents),
    subtotalCents: Number(r.subtotal_cents),
    totalCents: Number(r.total_cents),
    depositCents: Number(r.deposit_cents),
    balanceCents: Number(r.balance_cents),
    depositPaidAt: r.deposit_paid_at
      ? new Date(r.deposit_paid_at as string).toISOString()
      : null,
    balancePaidAt: r.balance_paid_at
      ? new Date(r.balance_paid_at as string).toISOString()
      : null,
    heldUntil: r.held_until
      ? new Date(r.held_until as string).toISOString()
      : null,
    latitude: r.latitude === null ? null : Number(r.latitude),
    longitude: r.longitude === null ? null : Number(r.longitude),
    formattedAddress: (r.formatted_address as string | null) ?? null,
    addOns: addOns.rows.map((a) => ({
      name: a.name,
      amountCents: Number(a.amount_cents),
    })),
  };
}

/** Resolve a booking's internal id from its human reference. */
export async function getBookingIdByReference(
  db: Queryable,
  reference: string,
): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `select id from booking where reference = $1`,
    [reference],
  );
  return rows[0]?.id ?? null;
}

/**
 * Append an attributed audit row. No booking lifecycle transition happens
 * without one (Standards: no silent state change). Does NOT open its own
 * transaction, so it composes inside the caller's.
 */
export async function recordBookingEvent(
  db: Queryable,
  e: {
    bookingId: string;
    type: string;
    actor: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  await db.query(
    `insert into booking_event (booking_id, type, actor, detail)
     values ($1, $2, $3, $4::jsonb)`,
    [e.bookingId, e.type, e.actor, JSON.stringify(e.detail ?? {})],
  );
}

export type RescheduleResult =
  | { ok: true; fromSlotId: string; toSlotId: string }
  | {
      ok: false;
      reason: 'not_reschedulable' | 'past_cutoff' | 'slot_unavailable';
    };

/**
 * Owner reschedule of a CONFIRMED booking, before the cutoff, as one atomic slot
 * swap — no new deposit is taken and none of the money fields move.
 *
 *  - Allowed only while `status = 'confirmed'`.
 *  - Rejected once the CURRENT slot is within `RESCHEDULE_CUTOFF_HOURS` of now
 *    (invariant 5: free reschedule only before the cutoff), measured with the
 *    DB clock.
 *  - Claims the target slot with `where status = 'open' and not closed` (the row
 *    lock serialises concurrent claims; the loser gets slot_unavailable), frees
 *    the old slot, and repoints the booking. The no-double-booking unique index
 *    is the backstop.
 *  - Attributed + recorded.
 */
export async function rescheduleBooking(
  db: Queryable,
  p: { bookingId: string; newSlotId: string; actor: string },
): Promise<RescheduleResult> {
  await db.query('begin');
  try {
    const cur = await db.query<{
      slot_id: string;
      status: string;
      past_cutoff: boolean;
    }>(
      `select b.slot_id, b.status,
              sl.start_at <= now() + make_interval(hours => $2) as past_cutoff
       from booking b join slot sl on sl.id = b.slot_id
       where b.id = $1`,
      [p.bookingId, RESCHEDULE_CUTOFF_HOURS],
    );
    const row = cur.rows[0];
    if (!row || row.status !== 'confirmed') {
      await db.query('rollback');
      return { ok: false, reason: 'not_reschedulable' };
    }
    if (row.past_cutoff) {
      await db.query('rollback');
      return { ok: false, reason: 'past_cutoff' };
    }
    if (row.slot_id === p.newSlotId) {
      await db.query('rollback');
      return { ok: false, reason: 'slot_unavailable' };
    }

    const claim = await db.query<{ id: string }>(
      `update slot set status = 'booked', booking_id = $2, held_until = null
       where id = $1 and status = 'open' and not closed
       returning id`,
      [p.newSlotId, p.bookingId],
    );
    if (claim.rows.length === 0) {
      await db.query('rollback');
      return { ok: false, reason: 'slot_unavailable' };
    }

    await db.query(
      `update slot set status = 'open', booking_id = null, held_until = null
       where id = $1`,
      [row.slot_id],
    );
    await db.query(`update booking set slot_id = $2 where id = $1`, [
      p.bookingId,
      p.newSlotId,
    ]);
    await recordBookingEvent(db, {
      bookingId: p.bookingId,
      type: 'rescheduled',
      actor: p.actor,
      detail: { from_slot: row.slot_id, to_slot: p.newSlotId },
    });

    await db.query('commit');
    return { ok: true, fromSlotId: row.slot_id, toSlotId: p.newSlotId };
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}

export type CancelResult =
  { ok: true } | { ok: false; reason: 'not_cancellable' };

/**
 * Owner cancel. The slot is released back to `open` so it can be rebooked; the
 * flat deposit is NON-REFUNDABLE and is therefore FORFEITED — the paid payment
 * row is left exactly as-is (no refund is issued here). Attributed + recorded.
 */
export async function cancelBooking(
  db: Queryable,
  p: { bookingId: string; actor: string },
): Promise<CancelResult> {
  await db.query('begin');
  try {
    const upd = await db.query<{ slot_id: string }>(
      `update booking set status = 'cancelled'
       where id = $1 and status in ('pending_deposit', 'confirmed')
       returning slot_id`,
      [p.bookingId],
    );
    if (upd.rows.length === 0) {
      await db.query('rollback');
      return { ok: false, reason: 'not_cancellable' };
    }
    await db.query(
      `update slot set status = 'open', booking_id = null, held_until = null
       where id = $1`,
      [upd.rows[0].slot_id],
    );
    await recordBookingEvent(db, {
      bookingId: p.bookingId,
      type: 'cancelled',
      actor: p.actor,
      detail: { deposit_forfeited: true },
    });
    await db.query('commit');
    return { ok: true };
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}

export type CompleteResult =
  { ok: true } | { ok: false; reason: 'not_completable' };

/**
 * Mark a confirmed booking completed after the valet has been done. The slot
 * stays `booked` (the appointment happened). Attributed + recorded.
 */
export async function completeBooking(
  db: Queryable,
  p: { bookingId: string; actor: string },
): Promise<CompleteResult> {
  await db.query('begin');
  try {
    const upd = await db.query<{ id: string }>(
      `update booking set status = 'completed'
       where id = $1 and status = 'confirmed' returning id`,
      [p.bookingId],
    );
    if (upd.rows.length === 0) {
      await db.query('rollback');
      return { ok: false, reason: 'not_completable' };
    }
    await recordBookingEvent(db, {
      bookingId: p.bookingId,
      type: 'completed',
      actor: p.actor,
    });
    await db.query('commit');
    return { ok: true };
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}
