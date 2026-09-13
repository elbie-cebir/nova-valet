'use server';

import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { updateLegal } from '@/lib/data/legal';
import { updateBusinessDetails } from '@/lib/data/business';
import { revalidateContent, CACHE_TAGS } from '@/lib/content/cache';

export type ActionResult = { ok: true } | { ok: false; reason: string };

const paras = (max: number) =>
  z.object({
    nl: z.string().trim().min(1).max(max),
    en: z.string().trim().min(1).max(max),
    fr: z.string().trim().min(1).max(max),
  });

const legalSchema = z.object({
  privacy: paras(20000),
  terms: paras(20000),
  cookie: paras(2000),
});

export async function updateLegalAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = legalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  await updateLegal(db, parsed.data);
  revalidateContent(CACHE_TAGS.legal);
  return { ok: true };
}

const businessSchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  address: z.string().trim().min(1).max(500),
  vatNumber: z.string().trim().min(1).max(60),
  contactEmail: z.string().trim().min(1).max(200),
  contactPhone: z.string().trim().min(1).max(60),
});

export async function updateBusinessAction(
  input: unknown,
): Promise<ActionResult> {
  await requireOwner();
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  await updateBusinessDetails(db, parsed.data);
  revalidateContent(CACHE_TAGS.business);
  return { ok: true };
}
