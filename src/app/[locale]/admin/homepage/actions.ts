'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { updateHomepageText, setHomeImageUrl } from '@/lib/data/homepage';
import { uploadPublicImage } from '@/lib/supabase/admin';
import { validateImage } from '@/lib/images';
import { revalidateContent, CACHE_TAGS } from '@/lib/content/cache';

export type ActionResult = { ok: true } | { ok: false; reason: string };

function bust() {
  revalidateContent(CACHE_TAGS.homepage);
}

const localeText = (max: number) =>
  z.object({
    nl: z.string().trim().min(1).max(max),
    en: z.string().trim().min(1).max(max),
    fr: z.string().trim().min(1).max(max),
  });

const textSchema = z.object({
  heroTitle: localeText(160),
  heroSub: localeText(400),
  areaSnippet: localeText(300),
});

export async function updateHomepageAction(
  input: unknown,
): Promise<ActionResult> {
  await requireOwner();
  const parsed = textSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  await updateHomepageText(db, parsed.data);
  bust();
  return { ok: true };
}

/**
 * Upload a before/after image (multipart form). Validates type + size, stores it
 * in the public `homepage` Storage bucket, saves the CDN URL, and revalidates.
 */
export async function uploadHomeImageAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireOwner();

  const field = formData.get('field');
  const file = formData.get('file');
  if (field !== 'before' && field !== 'after') {
    return { ok: false, reason: 'invalid' };
  }
  if (!(file instanceof File)) return { ok: false, reason: 'invalid' };

  const valid = validateImage(file.type, file.size);
  if (!valid.ok) return { ok: false, reason: valid.reason };

  const bytes = await file.arrayBuffer();
  const up = await uploadPublicImage({
    path: `${field}-${randomUUID()}.${valid.ext}`,
    bytes,
    contentType: file.type,
  });
  if (!up.ok) return { ok: false, reason: up.reason };

  const db = await getDb();
  await setHomeImageUrl(db, field, up.url);
  bust();
  return { ok: true };
}
