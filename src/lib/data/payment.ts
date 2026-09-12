import type { Queryable } from './types';
import type {
  PaymentKind,
  PaymentMethod,
  PaymentProvider,
} from '@/lib/payments/types';

/** Record a payment the moment its provider checkout is created (status open). */
export async function recordInitiatedPayment(
  db: Queryable,
  p: {
    bookingId: string;
    kind: PaymentKind;
    provider: PaymentProvider;
    method: PaymentMethod;
    providerPaymentId: string;
    amountCents: number;
    status?: string;
  },
): Promise<void> {
  await db.query(
    `insert into payment (
       booking_id, kind, provider, provider_payment_id, method, amount_cents, status
     ) values ($1, $2::payment_kind, $3::payment_provider, $4, $5::payment_method, $6, $7)`,
    [
      p.bookingId,
      p.kind,
      p.provider,
      p.providerPaymentId,
      p.method,
      p.amountCents,
      p.status ?? 'open',
    ],
  );
}

export type ConfirmResult = {
  applied: boolean;
  kind?: PaymentKind;
  bookingId?: string;
  reason?: string;
};

/**
 * Apply a provider-verified successful payment. The ONLY path that confirms a
 * booking (invariant: no confirmation without a provider-verified deposit).
 *
 * Idempotent: the payment row moves to `paid` only `where status <> 'paid'`, so
 * a redelivered webhook finds it already paid and no-ops. The booking/slot
 * transitions are likewise guarded (`where status = ...`), so nothing is
 * double-applied. Atomic (single transaction).
 *
 * Callers MUST have verified the payment with the provider first (Stripe
 * signature / Mollie status fetch) — this function trusts its inputs.
 */
export async function confirmPayment(
  db: Queryable,
  id: { provider: PaymentProvider; providerPaymentId: string },
): Promise<ConfirmResult> {
  await db.query('begin');
  try {
    const claim = await db.query<{ booking_id: string; kind: PaymentKind }>(
      `update payment set status = 'paid'
       where provider = $1::payment_provider and provider_payment_id = $2
         and status <> 'paid'
       returning booking_id, kind`,
      [id.provider, id.providerPaymentId],
    );

    if (claim.rows.length === 0) {
      // Already paid (redelivery) or unknown — either way, no-op.
      const seen = await db.query(
        `select 1 from payment
         where provider = $1::payment_provider and provider_payment_id = $2`,
        [id.provider, id.providerPaymentId],
      );
      await db.query('commit');
      return {
        applied: false,
        reason: seen.rows.length ? 'already_paid' : 'unknown_payment',
      };
    }

    const { booking_id: bookingId, kind } = claim.rows[0];

    if (kind === 'deposit') {
      // Confirm only if still awaiting deposit; book the slot only if still held.
      await db.query(
        `update booking set status = 'confirmed', deposit_paid_at = now()
         where id = $1 and status = 'pending_deposit'`,
        [bookingId],
      );
      await db.query(
        `update slot set status = 'booked'
         where booking_id = $1 and status = 'held'`,
        [bookingId],
      );
    } else {
      await db.query(
        `update booking set balance_paid_at = now()
         where id = $1 and balance_paid_at is null`,
        [bookingId],
      );
    }

    await db.query('commit');
    return { applied: true, kind, bookingId };
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}

/**
 * Mark a payment failed/canceled/expired. If it was the deposit and the booking
 * is still awaiting it, release the hold: slot → open, booking → expired.
 * (Failure/abandonment must not leave a slot stuck.)
 */
export async function failPayment(
  db: Queryable,
  id: { provider: PaymentProvider; providerPaymentId: string },
): Promise<{ applied: boolean; released: boolean }> {
  await db.query('begin');
  try {
    const claim = await db.query<{ booking_id: string; kind: PaymentKind }>(
      `update payment set status = 'failed'
       where provider = $1::payment_provider and provider_payment_id = $2
         and status not in ('paid', 'failed')
       returning booking_id, kind`,
      [id.provider, id.providerPaymentId],
    );
    let released = false;
    if (claim.rows.length > 0 && claim.rows[0].kind === 'deposit') {
      const { booking_id: bookingId } = claim.rows[0];
      await db.query(
        `update booking set status = 'expired'
         where id = $1 and status = 'pending_deposit'`,
        [bookingId],
      );
      const freed = await db.query(
        `update slot set status = 'open', booking_id = null, held_until = null
         where booking_id = $1 and status = 'held'
         returning id`,
        [bookingId],
      );
      released = freed.rows.length > 0;
    }
    await db.query('commit');
    return { applied: claim.rows.length > 0, released };
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}
