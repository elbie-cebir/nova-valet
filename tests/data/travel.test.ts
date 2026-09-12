import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import { getTravelFee } from '@/lib/data/travel';

describe('travel-fee lookup by postcode', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshSeededDb();
  });
  afterAll(async () => {
    await db.close();
  });

  it('returns fee and in-area for a base-area postcode', async () => {
    const r = await getTravelFee(db, '1000');
    expect(r).toMatchObject({ found: true, inArea: true, feeCents: 0 });
  });

  it('returns the travel fee for an outer in-area postcode', async () => {
    const r = await getTravelFee(db, '9000');
    expect(r).toMatchObject({ found: true, inArea: true, feeCents: 1500 });
  });

  it('reports out-of-area with no fee', async () => {
    const r = await getTravelFee(db, '2000');
    expect(r).toMatchObject({ found: true, inArea: false, feeCents: 0 });
  });

  it('fails closed for an unknown postcode', async () => {
    const r = await getTravelFee(db, '5000');
    expect(r).toEqual({ found: false, inArea: false, feeCents: 0 });
  });

  it('matches on prefix, longest first', async () => {
    // '10001' starts with the '1000' area prefix.
    const r = await getTravelFee(db, '10001');
    expect(r).toMatchObject({ found: true, prefix: '1000' });
  });

  it('fails closed for empty input', async () => {
    const r = await getTravelFee(db, '   ');
    expect(r.found).toBe(false);
  });
});
