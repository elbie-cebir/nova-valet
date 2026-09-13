import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';

/**
 * PART B — owner service-area management. Owner CRUD over postcode areas persists
 * and revalidates the service-area tag; a non-owner is denied; bad input is
 * rejected; and an edit is reflected by the customer travel-fee lookup.
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
  createAreaAction,
  updateAreaAction,
  deleteAreaAction,
} from '@/app/[locale]/admin/area/actions';
import { listPostcodeAreas } from '@/lib/data/area-admin';
import { getTravelFee } from '@/lib/data/travel';
import { revalidateTag } from 'next/cache';

let db: PGlite;
beforeEach(async () => {
  db = await freshSeededDb();
  h.db = db;
  h.owner = true;
  vi.mocked(revalidateTag).mockClear();
});

describe('service-area admin actions', () => {
  it('owner creates an area, revalidates, and the travel-fee lookup reflects it', async () => {
    const res = await createAreaAction({
      prefix: '3000',
      travelFeeCents: 1200,
      inArea: true,
    });
    expect(res.ok).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith('service-area');

    const fee = await getTravelFee(db, '3000');
    expect(fee).toMatchObject({ found: true, inArea: true, feeCents: 1200 });
  });

  it('updates an area (fee + in/out) and the lookup reflects it', async () => {
    const area = (await listPostcodeAreas(db)).find(
      (a) => a.prefix === '9000',
    )!;
    const res = await updateAreaAction({
      id: area.id,
      prefix: '9000',
      travelFeeCents: 500,
      inArea: false,
    });
    expect(res.ok).toBe(true);
    const fee = await getTravelFee(db, '9000');
    // out of area → feeCents 0 and inArea false
    expect(fee.inArea).toBe(false);
  });

  it('deletes an area and the lookup no longer finds it', async () => {
    const area = (await listPostcodeAreas(db)).find(
      (a) => a.prefix === '9000',
    )!;
    const res = await deleteAreaAction({ id: area.id });
    expect(res.ok).toBe(true);
    const fee = await getTravelFee(db, '9000');
    expect(fee.found).toBe(false);
  });

  it('denies a non-owner (fail closed) and does not persist', async () => {
    h.owner = false;
    await expect(
      createAreaAction({ prefix: '4000', travelFeeCents: 100, inArea: true }),
    ).rejects.toThrow();
    expect((await listPostcodeAreas(db)).some((a) => a.prefix === '4000')).toBe(
      false,
    );
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects invalid input and a duplicate prefix', async () => {
    const bad = await createAreaAction({
      prefix: 'abc',
      travelFeeCents: 100,
      inArea: true,
    });
    expect(bad.ok).toBe(false);
    const dup = await createAreaAction({
      prefix: '1000', // already seeded
      travelFeeCents: 100,
      inArea: true,
    });
    expect(dup.ok).toBe(false);
  });
});
