import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb, insertSlot } from '../db/db';

/**
 * Payments ledger + customers list + CSV export (B9). DAL runs against real
 * PGlite; the export route is exercised with mocked owner-auth to prove it fails
 * closed for a non-owner.
 */
const h = vi.hoisted(() => ({ db: null as unknown, owner: true }));
vi.mock('@/lib/data/db.server', () => ({ getDb: async () => h.db }));
vi.mock('@/lib/auth/owner', () => ({
  getAuthenticatedOwner: async () =>
    h.owner ? { id: 'o', email: 'owner@example.com' } : null,
}));

import {
  listPayments,
  countPayments,
  getPaymentSummary,
  listCustomers,
  countCustomers,
  customersToCsv,
} from '@/lib/data/reporting';
import { GET as exportCustomers } from '@/app/api/admin/customers/export/route';

let db: PGlite;

async function addBooking(opts: {
  ref: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
}): Promise<string> {
  const slotId = await insertSlot(db);
  const { rows } = await db.query<{ id: string }>(
    `insert into booking (
       reference, status, service_id, vehicle_size_tier_id, slot_id,
       customer_name, customer_phone, customer_email, address, postcode,
       travel_fee_cents, subtotal_cents, total_cents, deposit_cents,
       balance_cents, locale, created_at
     ) values (
       $1, 'confirmed',
       (select id from service limit 1),
       (select id from vehicle_size_tier limit 1),
       $2, $3, $4, $5, 'Addr 1', '1000',
       0, 5000, 5000, 2500, 2500, 'nl', $6
     ) returning id`,
    [opts.ref, slotId, opts.name, opts.phone, opts.email, opts.createdAt],
  );
  return rows[0].id;
}

async function addPayment(
  bookingId: string,
  kind: string,
  status: string,
  amount: number,
): Promise<void> {
  await db.query(
    `insert into payment (booking_id, kind, provider, method, amount_cents, status)
     values ($1, $2::payment_kind, 'stripe', 'card', $3, $4)`,
    [bookingId, kind, amount, status],
  );
}

beforeEach(async () => {
  db = await freshSeededDb();
  h.db = db;
  h.owner = true;
});

describe('payments ledger', () => {
  it('lists payments joined to bookings and summarizes paid vs refund_due', async () => {
    const b = await addBooking({
      ref: 'NV-PAY001',
      name: 'Ann',
      phone: '470',
      email: 'ann@x.com',
      createdAt: '2026-09-10T10:00:00Z',
    });
    await addPayment(b, 'deposit', 'paid', 2500);
    await addPayment(b, 'balance', 'paid', 2500);
    await addPayment(b, 'balance', 'refund_due', 2500);
    await addPayment(b, 'deposit', 'open', 2500);

    expect(await countPayments(db)).toBe(4);
    const rows = await listPayments(db, { limit: 20, offset: 0 });
    expect(rows).toHaveLength(4);
    expect(rows[0].reference).toBe('NV-PAY001');
    expect(rows[0].customerName).toBe('Ann');

    const s = await getPaymentSummary(db);
    expect(s.collectedCents).toBe(5000); // two paid rows
    expect(s.paidCount).toBe(2);
    expect(s.refundDueCount).toBe(1);
  });
});

describe('customers list', () => {
  it('groups by email, uses the latest name/phone, counts bookings', async () => {
    await addBooking({
      ref: 'NV-C1',
      name: 'Old Name',
      phone: '111',
      email: 'repeat@x.com',
      createdAt: '2026-09-01T10:00:00Z',
    });
    await addBooking({
      ref: 'NV-C2',
      name: 'New Name',
      phone: '222',
      email: 'repeat@x.com',
      createdAt: '2026-09-05T10:00:00Z',
    });
    await addBooking({
      ref: 'NV-C3',
      name: 'Solo',
      phone: '333',
      email: 'solo@x.com',
      createdAt: '2026-09-03T10:00:00Z',
    });

    const customers = await listCustomers(db);
    expect(customers).toHaveLength(2); // two distinct emails
    expect(await countCustomers(db)).toBe(2);
    const repeat = customers.find((c) => c.email === 'repeat@x.com')!;
    expect(repeat.bookings).toBe(2);
    expect(repeat.name).toBe('New Name'); // latest
    expect(repeat.phone).toBe('222');
    // newest activity first
    expect(customers[0].email).toBe('repeat@x.com');

    // pagination slices by distinct customer
    const p1 = await listCustomers(db, { limit: 1, offset: 0 });
    const p2 = await listCustomers(db, { limit: 1, offset: 1 });
    expect(p1).toHaveLength(1);
    expect(p2).toHaveLength(1);
    expect(p1[0].email).not.toBe(p2[0].email);
  });

  it('renders CSV with a header and escapes commas/quotes', () => {
    const csv = customersToCsv([
      {
        name: 'Doe, John',
        phone: '+32470',
        email: 'j@x.com',
        bookings: 3,
        lastBookingAt: '2026-09-05T10:00:00.000Z',
      },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Name,Mobile,Email,Bookings,Last booking');
    expect(lines[1]).toContain('"Doe, John"'); // comma quoted
    expect(lines[1]).toContain('j@x.com');
    expect(lines[1]).toContain('3');
  });
});

describe('customers export route (fails closed)', () => {
  it('returns CSV for the owner', async () => {
    await addBooking({
      ref: 'NV-E1',
      name: 'Exporter',
      phone: '999',
      email: 'e@x.com',
      createdAt: '2026-09-05T10:00:00Z',
    });
    const res = await exportCustomers();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    const body = await res.text();
    expect(body).toContain('Exporter');
  });

  it('returns 404 for a non-owner', async () => {
    h.owner = false;
    const res = await exportCustomers();
    expect(res.status).toBe(404);
  });
});
