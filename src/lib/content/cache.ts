import { unstable_cache, revalidateTag } from 'next/cache';

/**
 * Tag-based content cache — the B9 caching foundation.
 *
 * Customer pages (home, services, prices, legal, footer, booking flow) read
 * owner-managed content and settings THROUGH `cachedContent`, so a normal page
 * load is served from cache and does NOT hit the DB per request. Every admin
 * mutation calls `revalidateContent(<affected tag>)` (and, where a specific
 * route must repaint, `revalidatePath`) so an edit shows up immediately while
 * everything else keeps serving from cache.
 *
 * The tag a read is stored under is the same tag its admin editor revalidates —
 * that pairing is the whole contract. Keep this table and the CLAUDE.md "Content
 * cache" note in sync.
 *
 *   catalog       services, vehicle tiers, the price matrix, add-ons, deposit
 *   service-area  postcode areas + travel fees
 *   homepage      hero copy + before/after media
 *   reviews       testimonials
 *   legal         privacy / terms / cookie-consent text
 *   business      legal name, address, VAT number, contact details
 */
export const CACHE_TAGS = {
  catalog: 'catalog',
  serviceArea: 'service-area',
  homepage: 'homepage',
  reviews: 'reviews',
  legal: 'legal',
  business: 'business',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Wrap a DB read so its result is cached and invalidated by `tags`. Results are
 * keyed by `keyParts` plus the call arguments, so an arg'd reader (e.g. prices
 * for one tier) caches each argument separately.
 */
export function cachedContent<A extends unknown[], T>(
  loader: (...args: A) => Promise<T>,
  keyParts: string[],
  tags: CacheTag[],
): (...args: A) => Promise<T> {
  return unstable_cache(loader, keyParts, { tags }) as (
    ...args: A
  ) => Promise<T>;
}

/** Invalidate one or more content tags after an admin mutation. */
export function revalidateContent(...tags: CacheTag[]): void {
  for (const tag of tags) revalidateTag(tag);
}
