// Apply the SQL migrations (+ optional seed) to the database at DATABASE_URL.
// Runtime/ops tool — the DAL never imports this. Run with:
//   node --env-file=.env.local scripts/db-apply.mjs         # migrations only
//   node --env-file=.env.local scripts/db-apply.mjs --seed  # migrations + seed
import postgres from 'postgres';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    'DATABASE_URL is not set (use: node --env-file=.env.local ...)',
  );
  process.exit(1);
}
const withSeed = process.argv.includes('--seed');
const root = process.cwd();
const migDir = join(root, 'supabase', 'migrations');

const sql = postgres(url, { max: 1, ssl: 'require', prepare: false });

async function run(label, file) {
  process.stdout.write(`applying ${label} … `);
  await sql.unsafe(readFileSync(file, 'utf8')).simple();
  console.log('ok');
}

try {
  const files = readdirSync(migDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) await run(f, join(migDir, f));
  if (withSeed) await run('seed.sql', join(root, 'supabase', 'seed.sql'));
  console.log('done.');
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
