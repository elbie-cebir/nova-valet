import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';

/**
 * PART D — owner reviews management. Owner creates/updates/deletes testimonials,
 * revalidates the reviews tag, and only PUBLISHED reviews reach the customer
 * read. Non-owner denied; bad input rejected; nothing seeded.
 */
const h = vi.hoisted(() => ({ db: null as unknown, owner: true }));

vi.mock('@/lib/data/db.server', () => ({ getDb: async () => h.db }));
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));
vi.mock('@/lib/auth/owner', () => ({
  requireOwner: async () => {
    if (!h.owner) throw new Error('not owner');
    return { id: 'o', email: 'owner@example.com' };
  },
}));

import {
  createReviewAction,
  updateReviewAction,
  deleteReviewAction,
} from '@/app/[locale]/admin/reviews/actions';
import { getPublishedReviews, listReviewsAdmin } from '@/lib/data/reviews';
import { revalidateTag } from 'next/cache';

let db: PGlite;
beforeEach(async () => {
  db = await freshSeededDb();
  h.db = db;
  h.owner = true;
  vi.mocked(revalidateTag).mockClear();
});

describe('reviews admin', () => {
  it('starts with no reviews (nothing fabricated)', async () => {
    expect(await getPublishedReviews(db)).toEqual([]);
  });

  it('owner creates a review, revalidates, and it shows on the customer read', async () => {
    const res = await createReviewAction({
      authorName: 'Jan P.',
      body: 'Spotless work, on time.',
      rating: 5,
      published: true,
      sortOrder: 0,
    });
    expect(res.ok).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith('reviews');

    const pub = await getPublishedReviews(db);
    expect(pub).toHaveLength(1);
    expect(pub[0]).toMatchObject({ authorName: 'Jan P.', rating: 5 });
  });

  it('accepts an empty rating as null', async () => {
    const res = await createReviewAction({
      authorName: 'No Stars',
      body: 'Good.',
      rating: '',
      published: true,
      sortOrder: 0,
    });
    expect(res.ok).toBe(true);
    const pub = await getPublishedReviews(db);
    expect(pub[0].rating).toBeNull();
  });

  it('unpublished reviews are hidden from customers but visible in admin', async () => {
    await createReviewAction({
      authorName: 'Hidden',
      body: 'Draft.',
      rating: 4,
      published: false,
      sortOrder: 0,
    });
    expect(await getPublishedReviews(db)).toEqual([]);
    expect(await listReviewsAdmin(db)).toHaveLength(1);
  });

  it('updates and deletes a review', async () => {
    await createReviewAction({
      authorName: 'Edit Me',
      body: 'Before.',
      rating: 3,
      published: true,
      sortOrder: 0,
    });
    const r = (await listReviewsAdmin(db))[0];
    const upd = await updateReviewAction({
      id: r.id,
      authorName: 'Edited',
      body: 'After.',
      rating: 4,
      published: true,
      sortOrder: 1,
    });
    expect(upd.ok).toBe(true);
    expect((await getPublishedReviews(db))[0]).toMatchObject({
      authorName: 'Edited',
      body: 'After.',
      rating: 4,
    });

    const del = await deleteReviewAction({ id: r.id });
    expect(del.ok).toBe(true);
    expect(await listReviewsAdmin(db)).toEqual([]);
  });

  it('denies a non-owner and rejects invalid input', async () => {
    h.owner = false;
    await expect(
      createReviewAction({
        authorName: 'X',
        body: 'Y',
        rating: 5,
        published: true,
        sortOrder: 0,
      }),
    ).rejects.toThrow();
    h.owner = true;
    const bad = await createReviewAction({
      authorName: '',
      body: '',
      rating: 9,
      published: true,
      sortOrder: 0,
    });
    expect(bad.ok).toBe(false);
  });
});
