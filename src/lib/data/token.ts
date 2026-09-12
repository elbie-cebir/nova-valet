import { createHash, randomBytes } from 'node:crypto';
import type { Queryable } from './types';
import { getBookingByReference, type BookingSummary } from './booking';

// Tokens are stored HASHED at rest; the raw value is only ever in the URL/email.
function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** 256 bits of entropy, URL-safe. Unguessable. */
export function generateRawToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Mint a magic-link token for a booking and return the RAW token (store only its
 * hash). Expires after `ttlDays`. Multiple valid links per booking is fine (each
 * "get my link" issues one) — all hashed + expiring.
 */
export async function issueMagicLink(
  db: Queryable,
  bookingId: string,
  ttlDays = 90,
): Promise<string> {
  const raw = generateRawToken();
  await db.query(
    `insert into booking_token (booking_id, token_hash, kind, expires_at)
     values ($1, $2, 'magic_link', now() + make_interval(days => $3))`,
    [bookingId, hashToken(raw), ttlDays],
  );
  return raw;
}

/**
 * Resolve a raw token to its booking. Fails CLOSED: an unknown, used, or expired
 * token returns null (never another booking, never an existence leak).
 */
export async function resolveBookingByToken(
  db: Queryable,
  raw: string,
): Promise<BookingSummary | null> {
  if (!raw) return null;
  const { rows } = await db.query<{ reference: string }>(
    `select b.reference from booking_token t
     join booking b on b.id = t.booking_id
     where t.token_hash = $1 and t.used_at is null and t.expires_at > now()`,
    [hashToken(raw)],
  );
  const r = rows[0];
  if (!r) return null;
  return getBookingByReference(db, r.reference);
}

/**
 * Fallback lookup: a booking id from reference + a matching contact (email or
 * phone). Fails CLOSED — a wrong reference or wrong contact returns null, so the
 * caller can only ever reveal not-found, never someone else's booking.
 */
export async function findBookingByReferenceAndContact(
  db: Queryable,
  reference: string,
  contact: string,
): Promise<string | null> {
  const ref = reference.trim();
  const c = contact.trim();
  if (!ref || !c) return null;
  const { rows } = await db.query<{ id: string }>(
    `select id from booking
     where upper(reference) = upper($1)
       and (
         lower(customer_email) = lower($2)
         or replace(customer_phone, ' ', '') = replace($2, ' ', '')
       )`,
    [ref, c],
  );
  return rows[0]?.id ?? null;
}
