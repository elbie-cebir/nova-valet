import { PGlite } from '@electric-sql/pglite';
import { applyMigrations } from './migrate';
import type { Queryable } from './types';

/**
 * The app's data source for this step.
 *
 * B2 has no real Supabase keys yet (by design), so read surfaces run against a
 * single in-process PGlite database built from the same migrations + seed the
 * tests use. This is a local, seeded stand-in — swapping to a pooled connection
 * against the real Supabase Postgres is a later, env-driven step; DAL callers
 * won't change because they only depend on `Queryable`.
 *
 * Cached on globalThis so Next's dev hot-reload doesn't rebuild it every render.
 */
type Cache = { db?: Promise<PGlite> };
const globalCache = globalThis as unknown as { __novaDb?: Cache };
globalCache.__novaDb ??= {};

async function build(): Promise<PGlite> {
  const db = new PGlite();
  await applyMigrations(db, { seed: true });
  return db;
}

export async function getDb(): Promise<Queryable> {
  globalCache.__novaDb!.db ??= build();
  return globalCache.__novaDb!.db;
}
