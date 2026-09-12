import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb, insertBooking } from '../db/db';
import { getBookingIdByReference } from '@/lib/data/booking';
import {
  findBookingsDueForReminder,
  claimReminder,
} from '@/lib/data/reminders';
import { runReminderSweep } from '@/lib/notifications/reminders';
import type {
  WhatsAppAdapter,
  WhatsAppTemplateMessage,
} from '@/lib/whatsapp/types';

async function confirmedNear(
  db: PGlite,
  ref: string,
  hours: number,
): Promise<string> {
  const {
    rows: [slot],
  } = await db.query<{ id: string }>(
    `insert into slot (start_at, end_at, status)
     values (now() + make_interval(hours => $1),
             now() + make_interval(hours => $1) + interval '2 hours', 'booked')
     returning id`,
    [hours],
  );
  await insertBooking(db, {
    slotId: slot.id,
    reference: ref,
    status: 'confirmed',
  });
  return (await getBookingIdByReference(db, ref))!;
}

function spyAdapter(): {
  adapter: WhatsAppAdapter;
  calls: WhatsAppTemplateMessage[];
} {
  const calls: WhatsAppTemplateMessage[] = [];
  return {
    calls,
    adapter: {
      name: 'businessApi',
      enabled: true,
      buildLink: () => null,
      send: async (m) => {
        calls.push(m);
        return { sent: true, id: 'spy' };
      },
      sendText: async () => ({ sent: false, skipped: true }),
    },
  };
}

describe('reminder due query', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
  });
  afterEach(async () => {
    await db.close();
  });

  it('returns confirmed bookings inside the window, excludes the rest', async () => {
    const near = await confirmedNear(db, 'NV-RM0001', 12); // in 12h → due
    await confirmedNear(db, 'NV-RM0002', 48); // in 48h → not due
    // Confirmed, in window, but already reminded → not due.
    const alreadyId = await confirmedNear(db, 'NV-RM0003', 10);
    await db.query(
      `update booking set reminder_sent_at = now() where id = $1`,
      [alreadyId],
    );
    // In window but not confirmed → not due.
    await confirmedNear(db, 'NV-RM0004', 8);
    await db.query(
      `update booking set status = 'pending_deposit' where reference = 'NV-RM0004'`,
    );

    const due = await findBookingsDueForReminder(db, 24);
    expect(due.map((d) => d.id)).toEqual([near]);
  });

  it('claimReminder is atomic — only the first call wins', async () => {
    const id = await confirmedNear(db, 'NV-RM0005', 12);
    expect(await claimReminder(db, id)).toBe(true);
    expect(await claimReminder(db, id)).toBe(false);
  });
});

describe('reminder sweep', () => {
  let db: PGlite;
  beforeEach(async () => {
    db = await freshSeededDb();
    process.env.WHATSAPP_TEMPLATES_APPROVED = 'true'; // send the real template
  });
  afterEach(async () => {
    await db.close();
    delete process.env.WHATSAPP_TEMPLATES_APPROVED;
  });

  it('sends each due reminder once and never double-sends on a re-run', async () => {
    await confirmedNear(db, 'NV-RMS001', 12);
    await confirmedNear(db, 'NV-RMS002', 20);
    const { adapter, calls } = spyAdapter();

    const first = await runReminderSweep(db, { adapter });
    expect(first.due).toBe(2);
    expect(first.sent).toBe(2);
    expect(calls).toHaveLength(2);
    expect(calls[0].template).toBe('booking_reminder');

    // Second run: all claimed already → nothing sent.
    const second = await runReminderSweep(db, { adapter });
    expect(second.sent).toBe(0);
    expect(calls).toHaveLength(2);
  });

  it('owner-tap (manual) mode does not auto-send or claim', async () => {
    const id = await confirmedNear(db, 'NV-RMS003', 12);
    const manual: WhatsAppAdapter = {
      name: 'manual',
      enabled: true,
      buildLink: () => null,
      send: async () => ({ sent: false, skipped: true }),
      sendText: async () => ({ sent: false, skipped: true }),
    };
    const res = await runReminderSweep(db, { adapter: manual });
    expect(res.sent).toBe(0);
    // Not claimed → still eligible later.
    const { rows } = await db.query<{ reminder_sent_at: string | null }>(
      `select reminder_sent_at from booking where id = $1`,
      [id],
    );
    expect(rows[0].reminder_sent_at).toBeNull();
  });
});
