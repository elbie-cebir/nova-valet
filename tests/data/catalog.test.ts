import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';
import {
  getServicesWithFromPrice,
  getServicePricesForTier,
  getTiers,
  getAddOns,
} from '@/lib/data/catalog';

describe('catalog data access', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await freshSeededDb();
  });
  afterAll(async () => {
    await db.close();
  });

  it('returns services with their cheapest-tier "from" price, cheapest first', async () => {
    const services = await getServicesWithFromPrice(db);
    expect(services.length).toBe(4);
    // Seeded: exterior small is the cheapest overall (3000).
    expect(services[0].key).toBe('exterior');
    expect(services[0].fromCents).toBe(3000);
    // Ordered ascending by from-price.
    const fromPrices = services.map((s) => s.fromCents);
    expect([...fromPrices].sort((a, b) => a - b)).toEqual(fromPrices);
    // name/description carry i18n KEYS, never literal copy.
    expect(services[0].nameKey).toMatch(/^Catalog\./);
  });

  it('returns each service price at a specific tier', async () => {
    const large = await getServicePricesForTier(db, 'large');
    const full = large.find((s) => s.key === 'full');
    expect(full?.amountCents).toBe(16000);
    expect(full?.currency).toBe('EUR');
    // every active service priced at this tier
    expect(large.map((s) => s.key).sort()).toEqual([
      'both',
      'exterior',
      'full',
      'interior',
    ]);
  });

  it('returns tiers in sort order', async () => {
    const tiers = await getTiers(db);
    expect(tiers.map((t) => t.key)).toEqual([
      'small',
      'medium',
      'large',
      'van',
    ]);
  });

  it('returns active add-ons cheapest first', async () => {
    const addons = await getAddOns(db);
    expect(addons.length).toBe(4);
    const amounts = addons.map((a) => a.amountCents);
    expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
    expect(addons[0].nameKey).toMatch(/^AddOns\./);
  });
});
