import type { Queryable } from '@/lib/data/types';
import {
  findBookingsDueForReminder,
  claimReminder,
} from '@/lib/data/reminders';
import { notifyBookingReminder, type NotifyDeps } from './whatsapp';
import { getWhatsAppAdapter } from '@/lib/whatsapp';
import { REMINDER_LEAD_HOURS } from '@/config/constants';

/**
 * One reminder sweep (run by the cron): find bookings entering the reminder
 * window and send `booking_reminder` through the notification seam. Idempotent —
 * each booking is CLAIMED (`reminder_sent_at`) before sending, so it is never
 * double-sent even if the cron overlaps. When the active adapter isn't the
 * Cloud API (owner-tap mode), reminders aren't auto-sent and nothing is claimed.
 */
export async function runReminderSweep(
  db: Queryable,
  deps: NotifyDeps = {},
): Promise<{ due: number; sent: number }> {
  const adapter = deps.adapter ?? getWhatsAppAdapter();
  const due = await findBookingsDueForReminder(db, REMINDER_LEAD_HOURS);

  // Owner-tap mode: reminders are the owner's to send; don't auto-send/claim.
  if (adapter.name !== 'businessApi') return { due: due.length, sent: 0 };

  let sent = 0;
  for (const b of due) {
    if (!(await claimReminder(db, b.id))) continue; // lost the claim → skip
    const res = await notifyBookingReminder(db, b.id, { adapter });
    if (res.sent) sent += 1;
    else if (!res.skipped) {
      console.warn(`[reminder] send failed for ${b.id}: ${res.error}`);
    }
  }
  return { due: due.length, sent };
}
