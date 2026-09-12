import type { Queryable } from './types';

export type PaymentStatus =
  'awaiting_deposit' | 'balance_outstanding' | 'fully_paid';

export interface AdminBookingRow {
  reference: string;
  status: string;
  locale: string;
  customerName: string;
  customerEmail: string;
  serviceNameKey: string;
  tierLabelKey: string;
  slotStartAt: string;
  slotEndAt: string;
  totalCents: number;
  balanceCents: number;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  paymentStatus: PaymentStatus;
}

/** Derive the money state of a booking from what the provider has verified. */
export function paymentStatusOf(b: {
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  balanceCents: number;
}): PaymentStatus {
  if (!b.depositPaidAt) return 'awaiting_deposit';
  if (b.balancePaidAt || b.balanceCents === 0) return 'fully_paid';
  return 'balance_outstanding';
}

/**
 * Owner bookings list — most imminent first. ALWAYS bounded by limit/offset;
 * there is no unbounded booking read anywhere in the admin.
 */
export async function listBookings(
  db: Queryable,
  page: { limit: number; offset: number },
): Promise<AdminBookingRow[]> {
  const { rows } = await db.query<Record<string, unknown>>(
    `select b.reference, b.status, b.locale,
            b.customer_name, b.customer_email,
            s.name_key as service_name_key,
            t.label_key as tier_label_key,
            sl.start_at, sl.end_at,
            b.total_cents, b.balance_cents,
            b.deposit_paid_at, b.balance_paid_at
     from booking b
     join service s on s.id = b.service_id
     join vehicle_size_tier t on t.id = b.vehicle_size_tier_id
     join slot sl on sl.id = b.slot_id
     order by sl.start_at desc
     limit $1 offset $2`,
    [page.limit, page.offset],
  );
  return rows.map((r) => {
    const depositPaidAt = r.deposit_paid_at
      ? new Date(r.deposit_paid_at as string).toISOString()
      : null;
    const balancePaidAt = r.balance_paid_at
      ? new Date(r.balance_paid_at as string).toISOString()
      : null;
    const balanceCents = Number(r.balance_cents);
    return {
      reference: r.reference as string,
      status: r.status as string,
      locale: r.locale as string,
      customerName: r.customer_name as string,
      customerEmail: r.customer_email as string,
      serviceNameKey: r.service_name_key as string,
      tierLabelKey: r.tier_label_key as string,
      slotStartAt: new Date(r.start_at as string).toISOString(),
      slotEndAt: new Date(r.end_at as string).toISOString(),
      totalCents: Number(r.total_cents),
      balanceCents,
      depositPaidAt,
      balancePaidAt,
      paymentStatus: paymentStatusOf({
        depositPaidAt,
        balancePaidAt,
        balanceCents,
      }),
    };
  });
}

/** Total booking count, for pagination controls. */
export async function countBookings(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(*)::text as n from booking`,
  );
  return Number(rows[0].n);
}

export interface AdminPaymentRow {
  kind: string;
  provider: string;
  method: string;
  amountCents: number;
  status: string;
  providerPaymentId: string | null;
  createdAt: string;
}

/** All payment rows mirrored for a booking, newest first (incl. refund_due). */
export async function getPaymentsForBooking(
  db: Queryable,
  bookingId: string,
): Promise<AdminPaymentRow[]> {
  const { rows } = await db.query<{
    kind: string;
    provider: string;
    method: string;
    amount_cents: number;
    status: string;
    provider_payment_id: string | null;
    created_at: string;
  }>(
    `select kind, provider, method, amount_cents, status,
            provider_payment_id, created_at
     from payment where booking_id = $1
     order by created_at desc`,
    [bookingId],
  );
  return rows.map((r) => ({
    kind: r.kind,
    provider: r.provider,
    method: r.method,
    amountCents: Number(r.amount_cents),
    status: r.status,
    providerPaymentId: r.provider_payment_id,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export interface BookingEventRow {
  type: string;
  actor: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

/** The audit trail for a booking, newest first. */
export async function getBookingEvents(
  db: Queryable,
  bookingId: string,
): Promise<BookingEventRow[]> {
  const { rows } = await db.query<{
    type: string;
    actor: string;
    detail: Record<string, unknown>;
    created_at: string;
  }>(
    `select type, actor, detail, created_at
     from booking_event where booking_id = $1
     order by created_at desc`,
    [bookingId],
  );
  return rows.map((r) => ({
    type: r.type,
    actor: r.actor,
    detail: r.detail ?? {},
    createdAt: new Date(r.created_at).toISOString(),
  }));
}
