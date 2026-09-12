import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from './migrate';
import { createPgQueryable } from './pg.server';
import type { Queryable } from './types';

/**
 * The app's runtime data source.
 *
 * - When `DATABASE_URL` is set (production / any real environment), the DAL runs
 *   against real Postgres (Supabase) via a pooled connection. DAL callers are
 *   unchanged — they only depend on `Queryable`.
 * - With no `DATABASE_URL` (a bare local checkout), it falls back to a single
 *   in-process PGlite built from the same migrations + seed, so the app still
 *   runs without any external DB.
 *
 * Tests never call this: they construct their own PGlite `Queryable` directly,
 * so the unit suite stays hermetic regardless of `DATABASE_URL`.
 */
type Cache = { db?: Promise<PGlite> };
const globalCache = globalThis as unknown as { __novaDb?: Cache };
globalCache.__novaDb ??= {};

async function buildLocal(): Promise<PGlite> {
  const db = new PGlite();
  await applyMigrations(db, { seed: true });
  return db;
}

export async function getDb(): Promise<Queryable> {
  if (process.env.DATABASE_URL) {
    // Runtime: real Postgres. Fresh wrapper per call (isolated transaction
    // state); the connection pool underneath is shared.
    return createPgQueryable();
  }
  // Local fallback: seeded in-process PGlite.
  globalCache.__novaDb!.db ??= buildLocal();
  return globalCache.__novaDb!.db;
}
