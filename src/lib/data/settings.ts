import { z } from 'zod';
import type { Queryable } from './types';

/**
 * Key/value business settings. Values are stored as text and PARSED on read
 * (never trusted) into their real type. The deposit amount lives here now (was a
 * hardcoded constant) so the owner can change it from admin without a redeploy.
 */

const DEPOSIT_KEY = 'deposit_cents';
/** Fallback if the row is somehow missing — matches the historical constant. */
const DEPOSIT_FALLBACK_CENTS = 2500;

const depositSchema = z.coerce.number().int().min(0).max(1_000_000);

export async function getSetting(
  db: Queryable,
  key: string,
): Promise<string | null> {
  const { rows } = await db.query<{ value: string }>(
    `select value from setting where key = $1`,
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(
  db: Queryable,
  key: string,
  value: string,
): Promise<void> {
  await db.query(
    `insert into setting (key, value, updated_at)
     values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, value],
  );
}

/** The flat deposit in cents. Parsed; falls back to the historical default. */
export async function getDepositCents(db: Queryable): Promise<number> {
  const raw = await getSetting(db, DEPOSIT_KEY);
  const parsed = depositSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEPOSIT_FALLBACK_CENTS;
}

export async function setDepositCents(
  db: Queryable,
  cents: number,
): Promise<void> {
  const value = depositSchema.parse(cents);
  await setSetting(db, DEPOSIT_KEY, String(value));
}
