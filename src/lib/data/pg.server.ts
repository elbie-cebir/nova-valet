import postgres from 'postgres';
import type { Queryable } from './types';

type Pool = ReturnType<typeof postgres>;

// Shared pool, cached across dev hot-reloads.
const g = globalThis as unknown as { __novaPgPool?: Pool };

function getPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  g.__novaPgPool ??= postgres(url, { ssl: 'require', prepare: false, max: 10 });
  return g.__novaPgPool;
}

/**
 * A `Queryable` backed by a real Postgres pool (Supabase at runtime).
 *
 * The DAL manages transactions with literal `begin`/`commit`/`rollback` queries
 * (a pattern that is trivially correct on PGlite's single connection). On a
 * pool that only holds if every statement between begin and commit runs on the
 * SAME connection — so `begin` here RESERVES a dedicated connection and pins all
 * subsequent queries to it until `commit`/`rollback` release it.
 *
 * A fresh wrapper is returned per `getDb()` call, so its transaction state is
 * isolated to one request; only the underlying pool is shared. The DAL's SQL is
 * unchanged.
 */
export function createPgQueryable(): Queryable {
  const pool = getPool();
  let tx: Awaited<ReturnType<Pool['reserve']>> | null = null;

  return {
    async query<T = Record<string, unknown>>(
      text: string,
      params: unknown[] = [],
    ): Promise<{ rows: T[] }> {
      const cmd = text.trim().slice(0, 8).toLowerCase();

      if (cmd.startsWith('begin')) {
        tx = await pool.reserve();
        await tx.unsafe('begin');
        return { rows: [] as T[] };
      }

      const conn = tx ?? pool;
      const rows = (await conn.unsafe(
        text,
        params as never[],
      )) as unknown as T[];

      if (cmd.startsWith('commit') || cmd.startsWith('rollback')) {
        tx?.release();
        tx = null;
      }
      return { rows };
    },
  };
}
