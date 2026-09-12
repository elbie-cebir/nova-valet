'use server';

import { z } from 'zod';
import { getDb } from '@/lib/data/db.server';
import {
  findBookingByReferenceAndContact,
  issueMagicLink,
} from '@/lib/data/token';

const schema = z.object({
  reference: z.string().trim().min(1),
  contact: z.string().trim().min(1),
});

export type FindResult = { ok: true; token: string } | { ok: false };

/**
 * Resolve reference + contact to a booking and mint a magic link to its guest
 * view. Fails CLOSED: any mismatch returns `{ ok: false }` — the caller can only
 * ever show "not found", never another booking or an existence leak.
 */
export async function findBookingAction(input: unknown): Promise<FindResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const db = await getDb();
  const bookingId = await findBookingByReferenceAndContact(
    db,
    parsed.data.reference,
    parsed.data.contact,
  );
  if (!bookingId) return { ok: false };

  const token = await issueMagicLink(db, bookingId, 90);
  return { ok: true, token };
}
