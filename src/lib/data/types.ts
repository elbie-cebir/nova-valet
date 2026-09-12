/**
 * The narrow database surface the data-access layer depends on.
 *
 * Every DAL function takes a `Queryable` rather than importing a concrete
 * client, so the same query code runs against:
 *  - PGlite in tests (real Postgres, in-process — see the B1 setup), and
 *  - the local seeded PGlite instance the app reads from in this step,
 *  - and, later, a pooled connection to the real Supabase Postgres.
 *
 * Layers don't leak: components never see this — they call DAL functions,
 * which are the only code that speaks SQL.
 */
export interface Queryable {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
