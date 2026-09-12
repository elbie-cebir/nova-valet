'use server';

import { z } from 'zod';
import { getDb } from '@/lib/data/db.server';
import { rescheduleByToken, cancelByToken } from '@/lib/booking/guest';

export type GuestActionResult = { ok: true } | { ok: false; reason: string };

const rescheduleSchema = z.object({
  token: z.string().min(1),
  newSlotId: z.string().uuid(),
});

/**
 * Guest reschedule — token-scoped + fail-closed. The booking is resolved from
 * the token server-side; the client can't target another booking by crafting an
 * id. All rules (before-cutoff, confirmed-only, atomic, no new deposit) live in
 * the reused B6 pipeline.
 */
export async function guestRescheduleAction(
  input: unknown,
): Promise<GuestActionResult> {
  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  const res = await rescheduleByToken(db, {
    token: parsed.data.token,
    newSlotId: parsed.data.newSlotId,
  });
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}

const cancelSchema = z.object({ token: z.string().min(1) });

/** Guest cancel — token-scoped + fail-closed; reuses B6 cancel (slot released,
 * deposit forfeited, recorded). */
export async function guestCancelAction(
  input: unknown,
): Promise<GuestActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  const res = await cancelByToken(db, { token: parsed.data.token });
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}
