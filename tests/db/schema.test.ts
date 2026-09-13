import { describe, it, expect, afterEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, loadSeed } from './db';

describe('B1 schema + seed', () => {
  let db: PGlite;

  afterEach(async () => {
    if (db) await db.close();
  });

  it('migrations apply clean and create every Spec entity', async () => {
    db = await freshDb();
    const { rows } = await db.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' order by table_name`,
    );
    const tables = rows.map((r) => r.table_name);
    expect(tables).toEqual(
      [
        'add_on',
        'booking',
        'booking_add_on',
        'booking_event',
        'booking_token',
        'business_details',
        'homepage_content',
        'legal_content',
        'payment',
        'postcode_area',
        'price',
        'review',
        'service',
        'setting',
        'slot',
        'vehicle_size_tier',
      ].sort(),
    );
  });

  it('payment enums are provider(mollie|stripe) and method(bancontact|card)', async () => {
    db = await freshDb();
    const providers = await db.query<{ v: string }>(
      `select unnest(enum_range(null::payment_provider))::text as v`,
    );
    const methods = await db.query<{ v: string }>(
      `select unnest(enum_range(null::payment_method))::text as v`,
    );
    expect(providers.rows.map((r) => r.v).sort()).toEqual(['mollie', 'stripe']);
    expect(methods.rows.map((r) => r.v).sort()).toEqual(['bancontact', 'card']);
  });

  it('the no-double-booking partial unique index exists', async () => {
    db = await freshDb();
    const { rows } = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes
       where tablename = 'booking' and indexname = 'booking_one_active_per_slot'`,
    );
    expect(rows).toHaveLength(1);
  });

  it('seed loads placeholder catalog rows', async () => {
    db = await freshDb();
    await loadSeed(db);
    const counts = await db.query<{
      services: string;
      prices: string;
      areas: string;
    }>(
      `select
         (select count(*) from service)::text as services,
         (select count(*) from price)::text as prices,
         (select count(*) from postcode_area)::text as areas`,
    );
    expect(Number(counts.rows[0].services)).toBeGreaterThan(0);
    expect(Number(counts.rows[0].prices)).toBeGreaterThan(0);
    expect(Number(counts.rows[0].areas)).toBeGreaterThan(0);
  });
});
