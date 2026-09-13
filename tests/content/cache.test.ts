import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Faithful in-memory stand-in for Next's data cache: `unstable_cache` memoizes
 * by (keyParts + args) and records each entry under its tags; `revalidateTag`
 * drops every entry carrying that tag. This lets us prove OUR wiring — that a
 * content read is served from cache and that a mutation revalidating a tag
 * forces the next read to re-run — without a live Next server.
 */
const store = new Map<string, unknown>();
const tagIndex = new Map<string, Set<string>>();

vi.mock('next/cache', () => ({
  unstable_cache: (
    fn: (...a: unknown[]) => Promise<unknown>,
    keyParts: string[],
    opts: { tags?: string[] },
  ) => {
    return async (...args: unknown[]) => {
      const key = JSON.stringify([keyParts, args]);
      if (store.has(key)) return store.get(key);
      const val = await fn(...args);
      store.set(key, val);
      for (const tag of opts?.tags ?? []) {
        if (!tagIndex.has(tag)) tagIndex.set(tag, new Set());
        tagIndex.get(tag)!.add(key);
      }
      return val;
    };
  },
  revalidateTag: (tag: string) => {
    for (const key of tagIndex.get(tag) ?? []) store.delete(key);
    tagIndex.get(tag)?.clear();
  },
}));

import {
  CACHE_TAGS,
  cachedContent,
  revalidateContent,
} from '@/lib/content/cache';

beforeEach(() => {
  store.clear();
  tagIndex.clear();
});

describe('tag-based content cache', () => {
  it('serves a read from cache — the loader runs once for repeated reads', async () => {
    const loader = vi.fn(async () => ({ value: 42 }));
    const read = cachedContent(loader, ['t:read-once'], [CACHE_TAGS.catalog]);

    const a = await read();
    const b = await read();

    expect(a).toEqual({ value: 42 });
    expect(b).toEqual({ value: 42 });
    expect(loader).toHaveBeenCalledTimes(1); // second read hit the cache
  });

  it('caches per-argument so different inputs are stored separately', async () => {
    const loader = vi.fn(async (tier: string) => ({ tier }));
    const read = cachedContent(loader, ['t:by-arg'], [CACHE_TAGS.catalog]);

    await read('small');
    await read('small');
    await read('large');

    expect(loader).toHaveBeenCalledTimes(2); // one per distinct arg
  });

  it('revalidating a tag forces the next read to re-run the loader', async () => {
    const loader = vi.fn(async () => ({ n: 1 }));
    const read = cachedContent(loader, ['t:revalidate'], [CACHE_TAGS.catalog]);

    await read();
    expect(loader).toHaveBeenCalledTimes(1);

    revalidateContent(CACHE_TAGS.catalog); // simulate an admin mutation
    await read();
    expect(loader).toHaveBeenCalledTimes(2); // cache was invalidated
  });

  it('only revalidates the named tag — other tags stay cached', async () => {
    const catalogLoader = vi.fn(async () => 'catalog');
    const legalLoader = vi.fn(async () => 'legal');
    const readCatalog = cachedContent(
      catalogLoader,
      ['t:c'],
      [CACHE_TAGS.catalog],
    );
    const readLegal = cachedContent(legalLoader, ['t:l'], [CACHE_TAGS.legal]);

    await readCatalog();
    await readLegal();

    revalidateContent(CACHE_TAGS.legal);

    await readCatalog();
    await readLegal();

    expect(catalogLoader).toHaveBeenCalledTimes(1); // untouched
    expect(legalLoader).toHaveBeenCalledTimes(2); // re-run after its tag revalidated
  });

  it('exposes the six documented content tags', () => {
    expect(Object.values(CACHE_TAGS).sort()).toEqual(
      [
        'business',
        'catalog',
        'homepage',
        'legal',
        'reviews',
        'service-area',
      ].sort(),
    );
  });
});
