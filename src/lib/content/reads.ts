import { getDb } from '@/lib/data/db.server';
import * as catalog from '@/lib/data/catalog';
import { getTravelFee as getTravelFeeDal } from '@/lib/data/travel';
import { getDepositCents as getDepositCentsDal } from '@/lib/data/settings';
import { getHomepageContent as getHomepageContentDal } from '@/lib/data/homepage';
import { getPublishedReviews as getPublishedReviewsDal } from '@/lib/data/reviews';
import { getLegalContent as getLegalContentDal } from '@/lib/data/legal';
import { getBusinessDetails as getBusinessDetailsDal } from '@/lib/data/business';
import { cachedContent, CACHE_TAGS } from './cache';

/**
 * Cache-first content reads for customer surfaces. Each wraps a DAL function
 * (which speaks SQL and takes a `Queryable`) so callers never touch `getDb()`
 * or the DB per request — the result is served from cache until the matching
 * tag is revalidated by an admin edit.
 *
 * Catalog reads are localized: they take a `locale` and the cache keys each
 * locale separately, so nl/en/fr each cache their own rendered strings.
 */

export const getServicesWithFromPrice = cachedContent(
  async (locale: string) =>
    catalog.getServicesWithFromPrice(await getDb(), locale),
  ['content:services-from-price'],
  [CACHE_TAGS.catalog],
);

export const getServicePricesForTier = cachedContent(
  async (locale: string, tierKey: string) =>
    catalog.getServicePricesForTier(await getDb(), locale, tierKey),
  ['content:service-prices-tier'],
  [CACHE_TAGS.catalog],
);

export const getPriceMatrix = cachedContent(
  async () => catalog.getPriceMatrix(await getDb()),
  ['content:price-matrix'],
  [CACHE_TAGS.catalog],
);

export const getTiers = cachedContent(
  async (locale: string) => catalog.getTiers(await getDb(), locale),
  ['content:tiers'],
  [CACHE_TAGS.catalog],
);

export const getAddOns = cachedContent(
  async (locale: string) => catalog.getAddOns(await getDb(), locale),
  ['content:add-ons'],
  [CACHE_TAGS.catalog],
);

/** Flat deposit in cents — cached under the catalog tag (admin edits it there). */
export const getDepositCents = cachedContent(
  async () => getDepositCentsDal(await getDb()),
  ['content:deposit-cents'],
  [CACHE_TAGS.catalog],
);

export const getTravelFee = cachedContent(
  async (postcode: string) => getTravelFeeDal(await getDb(), postcode),
  ['content:travel-fee'],
  [CACHE_TAGS.serviceArea],
);

export const getHomepageContent = cachedContent(
  async (locale: string) => getHomepageContentDal(await getDb(), locale),
  ['content:homepage'],
  [CACHE_TAGS.homepage],
);

export const getPublishedReviews = cachedContent(
  async () => getPublishedReviewsDal(await getDb()),
  ['content:reviews'],
  [CACHE_TAGS.reviews],
);

export const getLegalContent = cachedContent(
  async (locale: string) => getLegalContentDal(await getDb(), locale),
  ['content:legal'],
  [CACHE_TAGS.legal],
);

export const getBusinessDetails = cachedContent(
  async () => getBusinessDetailsDal(await getDb()),
  ['content:business'],
  [CACHE_TAGS.business],
);
