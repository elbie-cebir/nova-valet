import type { PGlite } from '@electric-sql/pglite';
import { reserveSlot, getTierPrice } from '@/lib/data/booking';
import { recordInitiatedPayment } from '@/lib/data/payment';
import { HOLD_TTL_MINUTES } from '@/config/constants';
import type {
  PaymentKind,
  PaymentMethod,
  PaymentProvider,
} from '@/lib/payments/types';

/**
 * Create a pending_deposit booking on a fresh held slot, plus an OPEN payment
 * row for it — the state right before a provider webhook arrives.
 */
export async function setupPendingBooking(
  db: PGlite,
  opts: {
    reference: string;
    provider: PaymentProvider;
    providerPaymentId: string;
    method?: PaymentMethod;
    kind?: PaymentKind;
  },
): Promise<{
  bookingId: string;
  slotId: string;
  depositCents: number;
  balanceCents: number;
}> {
  const {
    rows: [slot],
  } = await db.query<{ id: string }>(
    `insert into slot (start_at, end_at, status)
     values ('2026-10-20T09:00:00Z','2026-10-20T11:00:00Z','open') returning id`,
  );
  const {
    rows: [svc],
  } = await db.query<{ id: string }>(
    `select id from service where key = 'full'`,
  );
  const price = await getTierPrice(db, svc.id, 'medium');
  if (!price) throw new Error('seed missing full/medium price');

  const depositCents = 2500;
  const balanceCents = price.amountCents - depositCents;
  const res = await reserveSlot(db, {
    slotId: slot.id,
    serviceId: svc.id,
    tierId: price.tierId,
    customerName: 'Payment Tester',
    customerPhone: '+320000000000',
    customerEmail: 'pay@example.com',
    address: '1 Pay St',
    postcode: '1000',
    locale: 'nl',
    reference: opts.reference,
    travelFeeCents: 0,
    subtotalCents: price.amountCents,
    totalCents: price.amountCents,
    depositCents,
    balanceCents,
    addOns: [],
    holdTtlMinutes: HOLD_TTL_MINUTES,
  });
  if (!res.ok) throw new Error(`reserve failed: ${res.reason}`);

  const kind = opts.kind ?? 'deposit';
  await recordInitiatedPayment(db, {
    bookingId: res.bookingId,
    kind,
    provider: opts.provider,
    method: opts.method ?? (opts.provider === 'stripe' ? 'card' : 'bancontact'),
    providerPaymentId: opts.providerPaymentId,
    amountCents: kind === 'deposit' ? depositCents : balanceCents,
  });

  return {
    bookingId: res.bookingId,
    slotId: slot.id,
    depositCents,
    balanceCents,
  };
}

export async function bookingStatus(
  db: PGlite,
  bookingId: string,
): Promise<string> {
  const { rows } = await db.query<{
    status: string;
    deposit_paid_at: string | null;
  }>(`select status from booking where id = $1`, [bookingId]);
  return rows[0].status;
}

export async function slotStatus(db: PGlite, slotId: string): Promise<string> {
  const { rows } = await db.query<{ status: string }>(
    `select status from slot where id = $1`,
    [slotId],
  );
  return rows[0].status;
}
