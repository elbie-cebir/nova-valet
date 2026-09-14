import type { Queryable } from './types';

/**
 * Owner reporting reads (B9): the payments ledger (a read-only mirror of provider
 * events — invariant 7, never written here) and the derived customer list with
 * CSV export. All reads are bounded.
 */

export interface PaymentLedgerRow {
  createdAt: string;
  reference: string;
  customerName: string;
  kind: string; // deposit | balance
  provider: string; // mollie | stripe
  method: string; // bancontact | card
  amountCents: number;
  status: string; // open | paid | refund_due | failed
}

export async function listPayments(
  db: Queryable,
  page: { limit: number; offset: number },
): Promise<PaymentLedgerRow[]> {
  const { rows } = await db.query<{
    created_at: string;
    reference: string;
    customer_name: string;
    kind: string;
    provider: string;
    method: string;
    amount_cents: number;
    status: string;
  }>(
    `select p.created_at, b.reference, b.customer_name,
            p.kind, p.provider, p.method, p.amount_cents, p.status
     from payment p
     join booking b on b.id = p.booking_id
     order by p.created_at desc
     limit $1 offset $2`,
    [page.limit, page.offset],
  );
  return rows.map((r) => ({
    createdAt: new Date(r.created_at).toISOString(),
    reference: r.reference,
    customerName: r.customer_name,
    kind: r.kind,
    provider: r.provider,
    method: r.method,
    amountCents: Number(r.amount_cents),
    status: r.status,
  }));
}

export async function countPayments(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from payment`,
  );
  return Number(rows[0]?.n ?? 0);
}

export interface PaymentSummary {
  collectedCents: number;
  paidCount: number;
  refundDueCount: number;
}

/** Money collected = sum of provider-verified (`paid`) rows; plus refund flags. */
export async function getPaymentSummary(
  db: Queryable,
): Promise<PaymentSummary> {
  const { rows } = await db.query<{
    collected: number;
    paid: number;
    refunds: number;
  }>(
    `select
       coalesce(sum(amount_cents) filter (where status = 'paid'), 0) as collected,
       count(*) filter (where status = 'paid') as paid,
       count(*) filter (where status = 'refund_due') as refunds
     from payment`,
  );
  const r = rows[0];
  return {
    collectedCents: Number(r?.collected ?? 0),
    paidCount: Number(r?.paid ?? 0),
    refundDueCount: Number(r?.refunds ?? 0),
  };
}

export interface CustomerRow {
  name: string;
  phone: string;
  email: string;
  bookings: number;
  lastBookingAt: string;
}

/**
 * Distinct customers derived from bookings (guest-only — there are no customer
 * accounts). Keyed by email; name/phone come from that customer's most recent
 * booking. Newest activity first. Bounded.
 */
export async function listCustomers(
  db: Queryable,
  page: { limit: number; offset: number } = { limit: 1000, offset: 0 },
): Promise<CustomerRow[]> {
  const { rows } = await db.query<{
    email: string;
    name: string;
    phone: string;
    bookings: number;
    last_at: string;
  }>(
    `select customer_email as email,
            (array_agg(customer_name order by created_at desc))[1] as name,
            (array_agg(customer_phone order by created_at desc))[1] as phone,
            count(*)::int as bookings,
            max(created_at) as last_at
     from booking
     group by customer_email
     order by max(created_at) desc
     limit $1 offset $2`,
    [page.limit, page.offset],
  );
  return rows.map((r) => ({
    name: r.name,
    phone: r.phone,
    email: r.email,
    bookings: Number(r.bookings),
    lastBookingAt: new Date(r.last_at).toISOString(),
  }));
}

/** Distinct customer count (by email) — for pagination. */
export async function countCustomers(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(distinct customer_email)::int as n from booking`,
  );
  return Number(rows[0]?.n ?? 0);
}

/** RFC-4180-ish CSV escaping. */
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Customers as CSV (header + rows). Used by the export route. */
export function customersToCsv(rows: CustomerRow[]): string {
  const header = ['Name', 'Mobile', 'Email', 'Bookings', 'Last booking'];
  const lines = rows.map((r) =>
    [
      csvCell(r.name),
      csvCell(r.phone),
      csvCell(r.email),
      String(r.bookings),
      r.lastBookingAt,
    ].join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
