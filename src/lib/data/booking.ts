import type { Queryable } from './types';

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
         balance_cents, locale
       ) values (
         $1, 'pending_deposit', $2, $3, $4,
         $5, $6, $7, $8, $9,
         $10, $11, $12, $13, $14, $15
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
  serviceKey: string;
  serviceNameKey: string;
  tierKey: string;
  tierLabelKey: string;
  slotStartAt: string;
  slotEndAt: string;
  address: string;
  postcode: string;
  travelFeeCents: number;
  subtotalCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
  heldUntil: string | null;
  addOns: { nameKey: string; amountCents: number }[];
}

/** Read a booking (with joined display keys) by its human reference. */
export async function getBookingByReference(
  db: Queryable,
  reference: string,
): Promise<BookingSummary | null> {
  const { rows } = await db.query<Record<string, unknown>>(
    `select b.id, b.reference, b.status, b.locale,
            s.key as service_key, s.name_key as service_name_key,
            t.key as tier_key, t.label_key as tier_label_key,
            sl.start_at as slot_start_at, sl.end_at as slot_end_at,
            sl.held_until,
            b.address, b.postcode, b.travel_fee_cents, b.subtotal_cents,
            b.total_cents, b.deposit_cents, b.balance_cents
     from booking b
     join service s on s.id = b.service_id
     join vehicle_size_tier t on t.id = b.vehicle_size_tier_id
     join slot sl on sl.id = b.slot_id
     where b.reference = $1`,
    [reference],
  );
  const r = rows[0];
  if (!r) return null;

  const addOns = await db.query<{ name_key: string; amount_cents: number }>(
    `select a.name_key, ba.amount_cents
     from booking_add_on ba
     join add_on a on a.id = ba.add_on_id
     where ba.booking_id = $1
     order by ba.amount_cents asc`,
    [r.id as string],
  );

  return {
    id: r.id as string,
    reference: r.reference as string,
    status: r.status as string,
    locale: r.locale as string,
    serviceKey: r.service_key as string,
    serviceNameKey: r.service_name_key as string,
    tierKey: r.tier_key as string,
    tierLabelKey: r.tier_label_key as string,
    slotStartAt: new Date(r.slot_start_at as string).toISOString(),
    slotEndAt: new Date(r.slot_end_at as string).toISOString(),
    address: r.address as string,
    postcode: r.postcode as string,
    travelFeeCents: Number(r.travel_fee_cents),
    subtotalCents: Number(r.subtotal_cents),
    totalCents: Number(r.total_cents),
    depositCents: Number(r.deposit_cents),
    balanceCents: Number(r.balance_cents),
    heldUntil: r.held_until
      ? new Date(r.held_until as string).toISOString()
      : null,
    addOns: addOns.rows.map((a) => ({
      nameKey: a.name_key,
      amountCents: Number(a.amount_cents),
    })),
  };
}
