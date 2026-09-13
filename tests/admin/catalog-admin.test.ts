import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';

/**
 * PART A — owner catalog + deposit management. Exercises the server actions
 * end-to-end against a real (PGlite) DB: owner edits persist and revalidate the
 * catalog tag; a non-owner is denied (fail closed); bad input is rejected; and
 * an edit is reflected by the customer-facing catalog read.
 */
const h = vi.hoisted(() => ({ db: null as unknown, owner: true }));

vi.mock('@/lib/data/db.server', () => ({ getDb: async () => h.db }));
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));
vi.mock('@/lib/auth/owner', () => ({
  requireOwner: async () => {
    if (!h.owner) throw new Error('not owner'); // real code notFound()s
    return { id: 'o', email: 'owner@example.com' };
  },
}));

import {
  updateServiceAction,
  updateTierAction,
  updatePricesAction,
  createAddOnAction,
  updateAddOnAction,
  updateDepositAction,
} from '@/app/[locale]/admin/catalog/actions';
import { getAdminServices, getAdminTiers } from '@/lib/data/catalog-admin';
import {
  getServicesWithFromPrice,
  getServicePricesForTier,
  getAddOns,
} from '@/lib/data/catalog';
import { getDepositCents } from '@/lib/data/settings';
import { revalidateTag } from 'next/cache';

const L = (s: string) => ({ nl: `${s} nl`, en: `${s} en`, fr: `${s} fr` });

let db: PGlite;
beforeEach(async () => {
  db = await freshSeededDb();
  h.db = db;
  h.owner = true;
  vi.mocked(revalidateTag).mockClear();
});

describe('catalog admin actions', () => {
  it('owner edit persists per-locale, revalidates, and reflects on the customer read', async () => {
    const svc = (await getAdminServices(db)).find((s) => s.key === 'exterior')!;
    const res = await updateServiceAction({
      id: svc.id,
      name: L('Wash'),
      desc: L('Desc'),
      active: true,
    });
    expect(res.ok).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith('catalog');

    const en = await getServicesWithFromPrice(db, 'en');
    const fr = await getServicesWithFromPrice(db, 'fr');
    expect(en.find((s) => s.key === 'exterior')!.name).toBe('Wash en');
    expect(fr.find((s) => s.key === 'exterior')!.name).toBe('Wash fr');
  });

  it('denies a non-owner (fail closed) and does not persist', async () => {
    h.owner = false;
    const svc = (await getAdminServices(db)).find((s) => s.key === 'exterior')!;
    await expect(
      updateServiceAction({
        id: svc.id,
        name: L('Hack'),
        desc: L('x'),
        active: true,
      }),
    ).rejects.toThrow();
    const after = (await getAdminServices(db)).find(
      (s) => s.key === 'exterior',
    )!;
    expect(after.nameEn).toBe('Exterior only'); // unchanged
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects invalid input and does not revalidate', async () => {
    const res = await updateServiceAction({
      id: 'not-a-uuid',
      name: { nl: '', en: '', fr: '' },
      desc: L('x'),
      active: true,
    });
    expect(res.ok).toBe(false);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('updates a price cell and reflects it on the tier read', async () => {
    const svc = (await getAdminServices(db)).find((s) => s.key === 'full')!;
    const tier = (await getAdminTiers(db)).find((t) => t.key === 'small')!;
    const res = await updatePricesAction({
      cells: [{ serviceId: svc.id, tierId: tier.id, amountCents: 9999 }],
    });
    expect(res.ok).toBe(true);
    const rows = await getServicePricesForTier(db, 'nl', 'small');
    expect(rows.find((r) => r.key === 'full')!.amountCents).toBe(9999);
  });

  it('updates a tier label and reflects it localized', async () => {
    const tier = (await getAdminTiers(db)).find((t) => t.key === 'small')!;
    const res = await updateTierAction({
      id: tier.id,
      label: L('Tiny'),
      desc: L('note'),
    });
    expect(res.ok).toBe(true);
    // getTiers is exercised indirectly; check admin read reflects it.
    const after = (await getAdminTiers(db)).find((t) => t.key === 'small')!;
    expect(after.labelEn).toBe('Tiny en');
  });

  it('creates an add-on then deactivates it (soft delete)', async () => {
    const create = await createAddOnAction({
      key: 'wax_seal',
      name: L('Wax'),
      amountCents: 1500,
    });
    expect(create.ok).toBe(true);
    let addons = await getAddOns(db, 'en');
    const created = addons.find((a) => a.key === 'wax_seal');
    expect(created?.name).toBe('Wax en');

    // Deactivate → excluded from the active customer read.
    const { getAdminAddOns } = await import('@/lib/data/catalog-admin');
    const full = (await getAdminAddOns(db)).find((a) => a.key === 'wax_seal')!;
    const upd = await updateAddOnAction({
      id: full.id,
      name: L('Wax'),
      amountCents: 1500,
      active: false,
    });
    expect(upd.ok).toBe(true);
    addons = await getAddOns(db, 'en');
    expect(addons.find((a) => a.key === 'wax_seal')).toBeUndefined();
  });

  it('rejects a duplicate add-on key', async () => {
    const res = await createAddOnAction({
      key: 'pet_hair', // already seeded
      name: L('Dup'),
      amountCents: 100,
    });
    expect(res.ok).toBe(false);
  });

  it('round-trips the deposit and rejects a negative amount', async () => {
    expect(await getDepositCents(db)).toBe(2500);
    const ok = await updateDepositAction({ amountCents: 3000 });
    expect(ok.ok).toBe(true);
    expect(await getDepositCents(db)).toBe(3000);

    const bad = await updateDepositAction({ amountCents: -5 });
    expect(bad.ok).toBe(false);
    expect(await getDepositCents(db)).toBe(3000); // unchanged
  });
});
