'use server';

import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import {
  updateService,
  updateTier,
  upsertPrice,
  createAddOn,
  updateAddOn,
} from '@/lib/data/catalog-admin';
import { setDepositCents } from '@/lib/data/settings';
import { revalidateContent, CACHE_TAGS } from '@/lib/content/cache';

export type ActionResult = { ok: true } | { ok: false; reason: string };

const localeText = (max: number) =>
  z.object({
    nl: z.string().trim().min(1).max(max),
    en: z.string().trim().min(1).max(max),
    fr: z.string().trim().min(1).max(max),
  });

const cents = z.coerce.number().int().min(0).max(1_000_000);

/** Every catalog edit invalidates the `catalog` tag so customer pages repaint. */
function bust() {
  revalidateContent(CACHE_TAGS.catalog);
}

const serviceSchema = z.object({
  id: z.string().uuid(),
  name: localeText(120),
  desc: localeText(400),
  active: z.coerce.boolean(),
});

export async function updateServiceAction(
  input: unknown,
): Promise<ActionResult> {
  await requireOwner();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  await updateService(db, parsed.data.id, {
    name: parsed.data.name,
    desc: parsed.data.desc,
    active: parsed.data.active,
  });
  bust();
  return { ok: true };
}

const tierSchema = z.object({
  id: z.string().uuid(),
  label: localeText(60),
  desc: localeText(80),
});

export async function updateTierAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = tierSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  await updateTier(db, parsed.data.id, {
    label: parsed.data.label,
    desc: parsed.data.desc,
  });
  bust();
  return { ok: true };
}

const pricesSchema = z.object({
  cells: z
    .array(
      z.object({
        serviceId: z.string().uuid(),
        tierId: z.string().uuid(),
        amountCents: cents,
      }),
    )
    .min(1)
    .max(64),
});

export async function updatePricesAction(
  input: unknown,
): Promise<ActionResult> {
  await requireOwner();
  const parsed = pricesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  for (const c of parsed.data.cells) {
    await upsertPrice(db, c.serviceId, c.tierId, c.amountCents);
  }
  bust();
  return { ok: true };
}

const createAddOnSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{2,40}$/),
  name: localeText(80),
  amountCents: cents,
});

export async function createAddOnAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = createAddOnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  try {
    await createAddOn(db, {
      key: parsed.data.key,
      name: parsed.data.name,
      amountCents: parsed.data.amountCents,
    });
  } catch {
    return { ok: false, reason: 'duplicate_key' };
  }
  bust();
  return { ok: true };
}

const updateAddOnSchema = z.object({
  id: z.string().uuid(),
  name: localeText(80),
  amountCents: cents,
  active: z.coerce.boolean(),
});

export async function updateAddOnAction(input: unknown): Promise<ActionResult> {
  await requireOwner();
  const parsed = updateAddOnSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  await updateAddOn(db, parsed.data.id, {
    name: parsed.data.name,
    amountCents: parsed.data.amountCents,
    active: parsed.data.active,
  });
  bust();
  return { ok: true };
}

const depositSchema = z.object({ amountCents: cents });

export async function updateDepositAction(
  input: unknown,
): Promise<ActionResult> {
  await requireOwner();
  const parsed = depositSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const db = await getDb();
  await setDepositCents(db, parsed.data.amountCents);
  bust();
  return { ok: true };
}
