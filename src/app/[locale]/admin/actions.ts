'use server';

import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { createSlots, setSlotClosed } from '@/lib/data/slots';
import {
  getBookingIdByReference,
  rescheduleBooking,
  cancelBooking,
  completeBooking,
} from '@/lib/data/booking';
import { businessWallClockToUtcIso } from '@/lib/time';

export type ActionResult = { ok: true } | { ok: false; reason: string };

/** Clear the owner session and return to the login screen. */
export async function signOutAction(locale: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: '/admin/login', locale });
}

export type CreateSlotsResult =
  | { ok: true; created: number; skipped: number }
  | { ok: false; reason: string };

const createSlotsSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  times: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const MAX_BULK_SLOTS = 400;

/**
 * Open slots across the chosen weekdays + start times over a date range. Each
 * candidate is converted from Brussels wall-clock to UTC and created through the
 * buffer-guarded DAL, so clashes are skipped, not fatal.
 */
export async function createSlotsAction(
  input: unknown,
): Promise<CreateSlotsResult> {
  await requireOwner();
  const parsed = createSlotsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const { weekdays, times, from, to } = parsed.data;

  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || toMs < fromMs) {
    return { ok: false, reason: 'invalid' };
  }

  const want = new Set(weekdays);
  const starts: string[] = [];
  for (let ms = fromMs; ms <= toMs; ms += 86_400_000) {
    const d = new Date(ms);
    if (!want.has(d.getUTCDay())) continue;
    const dateStr = d.toISOString().slice(0, 10);
    for (const time of times) {
      const iso = businessWallClockToUtcIso(`${dateStr}T${time}`);
      if (iso) starts.push(iso);
      if (starts.length > MAX_BULK_SLOTS) {
        return { ok: false, reason: 'too_many' };
      }
    }
  }
  if (starts.length === 0) return { ok: false, reason: 'invalid' };

  const db = await getDb();
  const { created, skipped } = await createSlots(db, starts);
  return { ok: true, created, skipped };
}

const setClosedSchema = z.object({
  slotId: z.string().uuid(),
  closed: z.boolean(),
});

export async function setSlotClosedAction(
  input: unknown,
): Promise<ActionResult> {
  await requireOwner();
  const parsed = setClosedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  const db = await getDb();
  const res = await setSlotClosed(db, parsed.data.slotId, parsed.data.closed);
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}

const rescheduleSchema = z.object({
  reference: z.string().min(1),
  newSlotId: z.string().uuid(),
});

export async function rescheduleAction(input: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  const db = await getDb();
  const bookingId = await getBookingIdByReference(db, parsed.data.reference);
  if (!bookingId) return { ok: false, reason: 'not_found' };

  const res = await rescheduleBooking(db, {
    bookingId,
    newSlotId: parsed.data.newSlotId,
    actor: owner.email,
  });
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}

const refSchema = z.object({ reference: z.string().min(1) });

export async function cancelAction(input: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = refSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  const db = await getDb();
  const bookingId = await getBookingIdByReference(db, parsed.data.reference);
  if (!bookingId) return { ok: false, reason: 'not_found' };

  const res = await cancelBooking(db, { bookingId, actor: owner.email });
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}

export async function completeAction(input: unknown): Promise<ActionResult> {
  const owner = await requireOwner();
  const parsed = refSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  const db = await getDb();
  const bookingId = await getBookingIdByReference(db, parsed.data.reference);
  if (!bookingId) return { ok: false, reason: 'not_found' };

  const res = await completeBooking(db, { bookingId, actor: owner.email });
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}
