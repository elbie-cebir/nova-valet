import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const SEED_FILE = join(ROOT, 'supabase', 'seed.sql');

/** Minimal exec surface (PGlite satisfies this). Kept separate from Queryable. */
interface Executable {
  exec(sql: string): Promise<unknown>;
}

/**
 * Apply every migration in `supabase/migrations` (lexicographic order), and
 * optionally the placeholder seed. Shared by the app's local DB and the test
 * harness so there is one source of truth for "how the schema is built".
 */
export async function applyMigrations(
  db: Executable,
  opts: { seed?: boolean } = {},
): Promise<void> {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
  }
  if (opts.seed) {
    await applySeed(db);
  }
}

/** Apply only the placeholder seed to an already-migrated database. */
export async function applySeed(db: Executable): Promise<void> {
  await db.exec(readFileSync(SEED_FILE, 'utf8'));
}
