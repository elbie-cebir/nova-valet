'use server';

import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { createSlot, setSlotClosed } from '@/lib/data/slots';
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

const createSlotSchema = z.object({ localDateTime: z.string().min(1) });

export async function createSlotAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = createSlotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  const startAt = businessWallClockToUtcIso(parsed.data.localDateTime);
  if (!startAt) return { ok: false, reason: 'invalid' };

  const db = await getDb();
  const res = await createSlot(db, { startAt });
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
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
