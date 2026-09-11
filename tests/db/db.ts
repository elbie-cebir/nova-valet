import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const SEED_FILE = join(ROOT, 'supabase', 'seed.sql');

/**
 * Spin up a fresh in-process Postgres (PGlite) and apply every migration in
 * order. This is the real Postgres engine, so enums, checks and partial
 * unique indexes behave exactly as they will on Supabase.
 */
export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

/** Load the placeholder seed into an already-migrated database. */
export async function loadSeed(db: PGlite): Promise<void> {
  await db.exec(readFileSync(SEED_FILE, 'utf8'));
}

/**
 * Insert a slot and return its id. Times are fixed strings so tests never
 * depend on the wall clock.
 */
export async function insertSlot(db: PGlite): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into slot (start_at, end_at)
     values ('2026-10-01T09:00:00Z', '2026-10-01T11:00:00Z')
     returning id`,
  );
  return rows[0].id;
}

/**
 * Insert a booking against a slot with a given status. All money/contact
 * fields are filled with valid placeholders so the row satisfies every
 * NOT NULL / CHECK constraint; the test only cares about (slot_id, status).
 */
export async function insertBooking(
  db: PGlite,
  opts: { slotId: string; reference: string; status: string },
): Promise<void> {
  await db.query(
    `insert into booking (
       reference, status, service_id, vehicle_size_tier_id, slot_id,
       customer_name, customer_phone, customer_email, address, postcode,
       travel_fee_cents, subtotal_cents, total_cents, deposit_cents,
       balance_cents, locale
     )
     values (
       $1, $2::booking_status,
       (select id from service limit 1),
       (select id from vehicle_size_tier limit 1),
       $3,
       'Placeholder Name', '+320000000000', 'guest@example.com',
       '1 Placeholder St', '1000',
       0, 5000, 5000, 2500, 2500, 'nl'
     )`,
    [opts.reference, opts.status, opts.slotId],
  );
}
