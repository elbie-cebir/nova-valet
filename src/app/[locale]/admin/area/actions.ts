'use server';

import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import {
  createPostcodeArea,
  updatePostcodeArea,
  deletePostcodeArea,
} from '@/lib/data/area-admin';
import { revalidateContent, CACHE_TAGS } from '@/lib/content/cache';

export type ActionResult = { ok: true } | { ok: false; reason: string };

function bust() {
  revalidateContent(CACHE_TAGS.serviceArea);
}

const cents = z.coerce.number().int().min(0).max(1_000_000);
const areaBody = z.object({
  prefix: z
    .string()
    .trim()
    .regex(/^\d{2,6}$/),
  travelFeeCents: cents,
  inArea: z.coerce.boolean(),
});

const createSchema = areaBody;
const updateSchema = areaBody.extend({ id: z.string().uuid() });
const deleteSchema = z.object({ id: z.string().uuid() });

export async function createAreaAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  try {
    await createPostcodeArea(db, parsed.data);
  } catch {
    return { ok: false, reason: 'duplicate_prefix' };
  }
  bust();
  return { ok: true };
}

export async function updateAreaAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const { id, ...v } = parsed.data;
  const db = await getDb();
  try {
    await updatePostcodeArea(db, id, v);
  } catch {
    return { ok: false, reason: 'duplicate_prefix' };
  }
  bust();
  return { ok: true };
}

export async function deleteAreaAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  await deletePostcodeArea(db, parsed.data.id);
  bust();
  return { ok: true };
}
