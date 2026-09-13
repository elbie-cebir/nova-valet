'use server';

import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { createReview, updateReview, deleteReview } from '@/lib/data/reviews';
import { revalidateContent, CACHE_TAGS } from '@/lib/content/cache';

export type ActionResult = { ok: true } | { ok: false; reason: string };

function bust() {
  revalidateContent(CACHE_TAGS.reviews);
}

// Empty rating → null; otherwise an integer 1–5.
const rating = z
  .preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : v),
    z.coerce.number().int().min(1).max(5).nullable(),
  )
  .nullable();

const body = z.object({
  authorName: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(1000),
  rating,
  published: z.coerce.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(9999).catch(0),
});

const createSchema = body;
const updateSchema = body.extend({ id: z.string().uuid() });
const deleteSchema = z.object({ id: z.string().uuid() });

export async function createReviewAction(
  input: unknown,
): Promise<ActionResult> {
  await requireOwner();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  await createReview(db, parsed.data);
  bust();
  return { ok: true };
}

export async function updateReviewAction(
  input: unknown,
): Promise<ActionResult> {
  await requireOwner();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const { id, ...v } = parsed.data;
  const db = await getDb();
  await updateReview(db, id, v);
  bust();
  return { ok: true };
}

export async function deleteReviewAction(
  input: unknown,
): Promise<ActionResult> {
  await requireOwner();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  await deleteReview(db, parsed.data.id);
  bust();
  return { ok: true };
}
