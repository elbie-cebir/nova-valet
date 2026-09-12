import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import { setupPendingBooking } from '../payments/helpers';
import { confirmPayment } from '@/lib/data/payment';
import { notifyBookingConfirmed } from '@/lib/notifications/whatsapp';
import type {
  WhatsAppAdapter,
  WhatsAppTemplateMessage,
} from '@/lib/whatsapp/types';

function spyAdapter(name: 'manual' | 'businessApi'): {
  adapter: WhatsAppAdapter;
  calls: WhatsAppTemplateMessage[];
} {
  const calls: WhatsAppTemplateMessage[] = [];
  const adapter: WhatsAppAdapter = {
    name,
    enabled: name === 'businessApi',
    buildLink: () => null,
    send: async (msg) => {
      calls.push(msg);
      return { sent: true, id: 'spy' };
    },
  };
  return { adapter, calls };
}

describe('WhatsApp confirmation seam routing', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
    process.env.WHATSAPP_TEMPLATES_APPROVED = 'true'; // exercise the real template
  });
  afterEach(async () => {
    await db.close();
    delete process.env.WHATSAPP_TEMPLATES_APPROVED;
  });

  async function confirmed(ref: string, pid: string) {
    const s = await setupPendingBooking(db, {
      reference: ref,
      provider: 'stripe',
      providerPaymentId: pid,
    });
    await confirmPayment(db, { provider: 'stripe', providerPaymentId: pid });
    return s;
  }

  it('routes to the API adapter when businessApi is active', async () => {
    const b = await confirmed('NV-WA0001', 'cs_wa_1');
    const { adapter, calls } = spyAdapter('businessApi');

    const res = await notifyBookingConfirmed(db, b.bookingId, { adapter });

    expect(res.sent).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].template).toBe('booking_confirmation');
    expect(calls[0].toPhone).toBeTruthy();
    // Positional params carry the booking context (name + reference at least).
    expect(calls[0].params).toEqual(
      expect.arrayContaining(['Payment Tester', 'NV-WA0001']),
    );
  });

  it('does NOT auto-send when the adapter is manual (owner-tap stays)', async () => {
    const b = await confirmed('NV-WA0002', 'cs_wa_2');
    const { adapter, calls } = spyAdapter('manual');

    const res = await notifyBookingConfirmed(db, b.bookingId, { adapter });

    expect(res.skipped).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it('never throws when the send fails (confirm stays safe)', async () => {
    const b = await confirmed('NV-WA0003', 'cs_wa_3');
    const failing: WhatsAppAdapter = {
      name: 'businessApi',
      enabled: true,
      buildLink: () => null,
      send: async () => {
        throw new Error('graph exploded');
      },
    };
    const res = await notifyBookingConfirmed(db, b.bookingId, {
      adapter: failing,
    });
    expect(res.sent).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
