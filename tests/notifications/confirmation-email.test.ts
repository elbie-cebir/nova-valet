import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import { confirmPayment } from '@/lib/data/payment';
import { issueMagicLink, resolveBookingByToken } from '@/lib/data/token';
import { onDepositConfirmed } from '@/lib/notifications/booking';
import { setupPendingBooking } from '../payments/helpers';

describe('confirmation email on deposit confirm', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('invokes the mailer with the magic-link token URL, to the guest email', async () => {
    const { bookingId } = await setupPendingBooking(db, {
      reference: 'NV-MAIL01',
      provider: 'stripe',
      providerPaymentId: 'cs_mail_1',
    });
    // Deposit is verified/confirmed first (as the webhook does).
    await confirmPayment(db, {
      provider: 'stripe',
      providerPaymentId: 'cs_mail_1',
    });

    const calls: {
      to: string;
      reference: string;
      magicLinkUrl: string;
      locale: string;
    }[] = [];
    const mailer = async (opts: (typeof calls)[number]) => {
      calls.push(opts);
      return { sent: true, id: 'test' };
    };

    const res = await onDepositConfirmed(db, bookingId, {
      issue: issueMagicLink,
      mail: mailer,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe('pay@example.com');
    expect(calls[0].reference).toBe('NV-MAIL01');
    expect(calls[0].magicLinkUrl).toContain('/booking/');
    expect(res?.url).toContain('/booking/');

    // The emailed link's token really resolves to this booking.
    const raw = res!.url.split('/booking/')[1];
    const resolved = await resolveBookingByToken(db, raw);
    expect(resolved?.reference).toBe('NV-MAIL01');
  });
});
