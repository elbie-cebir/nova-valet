'use server';

import { z } from 'zod';
import { getDb } from '@/lib/data/db.server';
import {
  rescheduleByToken,
  cancelByToken,
  reviewByToken,
} from '@/lib/booking/guest';
import { revalidateContent, CACHE_TAGS } from '@/lib/content/cache';

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

const reviewSchema = z.object({
  token: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(1000).optional().default(''),
});

/**
 * Guest "rate your service" — token-scoped + fail-closed. Only a fully-paid
 * booking can be rated, once; the review is created unpublished for owner
 * approval. Revalidates the reviews tag (so an approved one can surface).
 */
export async function guestReviewAction(
  input: unknown,
): Promise<GuestActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  const res = await reviewByToken(db, {
    token: parsed.data.token,
    rating: parsed.data.rating,
    body: parsed.data.body,
  });
  if (res.ok) revalidateContent(CACHE_TAGS.reviews);
  return res.ok ? { ok: true } : { ok: false, reason: res.reason };
}
