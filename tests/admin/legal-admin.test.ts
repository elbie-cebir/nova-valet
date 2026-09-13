import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';

/**
 * PART E — owner legal pages + business details. Owner edits persist, revalidate
 * their tags, and reflect on the customer reads (legal pages / footer). Per-locale
 * legal text renders per locale; a non-owner is denied; bad input is rejected.
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
  updateLegalAction,
  updateBusinessAction,
} from '@/app/[locale]/admin/legal/actions';
import { getLegalContent } from '@/lib/data/legal';
import { getBusinessDetails } from '@/lib/data/business';
import { revalidateTag } from 'next/cache';

const L = (s: string) => ({ nl: `${s} nl`, en: `${s} en`, fr: `${s} fr` });

let db: PGlite;
beforeEach(async () => {
  db = await freshSeededDb();
  h.db = db;
  h.owner = true;
  vi.mocked(revalidateTag).mockClear();
});

describe('legal + business admin', () => {
  it('seeds clearly-marked placeholders, not real values', async () => {
    const legal = await getLegalContent(db, 'en');
    const biz = await getBusinessDetails(db);
    expect(legal?.privacy).toContain('[');
    expect(biz?.vatNumber).toContain('[');
  });

  it('owner edits legal text per locale, revalidates, and it reflects', async () => {
    const res = await updateLegalAction({
      privacy: L('Privacy'),
      terms: L('Terms'),
      cookie: L('Cookie'),
    });
    expect(res.ok).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith('legal');

    expect((await getLegalContent(db, 'en'))?.privacy).toBe('Privacy en');
    expect((await getLegalContent(db, 'fr'))?.terms).toBe('Terms fr');
    expect((await getLegalContent(db, 'nl'))?.cookie).toBe('Cookie nl');
  });

  it('owner edits business details, revalidates, and it reflects on the footer read', async () => {
    const res = await updateBusinessAction({
      legalName: 'Nova Valet BV',
      address: 'Main St 1, 1000 Brussels',
      vatNumber: 'BE0123456789',
      contactEmail: 'hi@example.com',
      contactPhone: '+32470000000',
    });
    expect(res.ok).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith('business');
    const biz = await getBusinessDetails(db);
    expect(biz).toMatchObject({
      legalName: 'Nova Valet BV',
      vatNumber: 'BE0123456789',
    });
  });

  it('denies a non-owner and rejects invalid input', async () => {
    h.owner = false;
    await expect(
      updateBusinessAction({
        legalName: 'x',
        address: 'x',
        vatNumber: 'x',
        contactEmail: 'x',
        contactPhone: 'x',
      }),
    ).rejects.toThrow();
    h.owner = true;
    const bad = await updateLegalAction({
      privacy: { nl: '', en: '', fr: '' },
      terms: L('t'),
      cookie: L('c'),
    });
    expect(bad.ok).toBe(false);
  });
});
