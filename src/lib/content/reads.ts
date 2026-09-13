import { getDb } from '@/lib/data/db.server';
import * as catalog from '@/lib/data/catalog';
import { getTravelFee as getTravelFeeDal } from '@/lib/data/travel';
import { cachedContent, CACHE_TAGS } from './cache';

/**
 * Cache-first content reads for customer surfaces. Each wraps a DAL function
 * (which speaks SQL and takes a `Queryable`) so callers never touch `getDb()`
 * or the DB per request — the result is served from cache until the matching
 * tag is revalidated by an admin edit.
 *
 * Pages import these instead of the raw `@/lib/data/*` functions. The DAL stays
 * the single place that writes SQL; this is only the caching seam over it.
 */

export const getServicesWithFromPrice = cachedContent(
  async () => catalog.getServicesWithFromPrice(await getDb()),
  ['content:services-from-price'],
  [CACHE_TAGS.catalog],
);

export const getServicePricesForTier = cachedContent(
  async (tierKey: string) =>
    catalog.getServicePricesForTier(await getDb(), tierKey),
  ['content:service-prices-tier'],
  [CACHE_TAGS.catalog],
);

export const getPriceMatrix = cachedContent(
  async () => catalog.getPriceMatrix(await getDb()),
  ['content:price-matrix'],
  [CACHE_TAGS.catalog],
);

export const getTiers = cachedContent(
  async () => catalog.getTiers(await getDb()),
  ['content:tiers'],
  [CACHE_TAGS.catalog],
);

export const getAddOns = cachedContent(
  async () => catalog.getAddOns(await getDb()),
  ['content:add-ons'],
  [CACHE_TAGS.catalog],
);

export const getTravelFee = cachedContent(
  async (postcode: string) => getTravelFeeDal(await getDb(), postcode),
  ['content:travel-fee'],
  [CACHE_TAGS.serviceArea],
);
