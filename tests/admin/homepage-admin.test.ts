import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshSeededDb } from '../db/db';

/**
 * PART C — owner homepage content + media. Text edits persist, revalidate the
 * homepage tag, and reflect on the customer read; a non-owner is denied; invalid
 * text is rejected; image validation rejects bad type/size; the image-URL setter
 * reflects on the read.
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
  updateHomepageAction,
  uploadHomeImageAction,
} from '@/app/[locale]/admin/homepage/actions';
import { validateImage, MAX_IMAGE_BYTES } from '@/lib/images';
import { getHomepageContent, setHomeImageUrl } from '@/lib/data/homepage';
import { revalidateTag } from 'next/cache';

const L = (s: string) => ({ nl: `${s} nl`, en: `${s} en`, fr: `${s} fr` });

let db: PGlite;
beforeEach(async () => {
  db = await freshSeededDb();
  h.db = db;
  h.owner = true;
  vi.mocked(revalidateTag).mockClear();
});

describe('homepage admin', () => {
  it('owner edits hero/area text, revalidates, and it reflects per locale', async () => {
    const res = await updateHomepageAction({
      heroTitle: L('Title'),
      heroSub: L('Sub'),
      areaSnippet: L('Area'),
    });
    expect(res.ok).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith('homepage');

    const en = await getHomepageContent(db, 'en');
    const fr = await getHomepageContent(db, 'fr');
    expect(en?.heroTitle).toBe('Title en');
    expect(en?.areaSnippet).toBe('Area en');
    expect(fr?.heroSub).toBe('Sub fr');
  });

  it('denies a non-owner (fail closed)', async () => {
    h.owner = false;
    await expect(
      updateHomepageAction({
        heroTitle: L('X'),
        heroSub: L('X'),
        areaSnippet: L('X'),
      }),
    ).rejects.toThrow();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('rejects empty text', async () => {
    const res = await updateHomepageAction({
      heroTitle: { nl: '', en: '', fr: '' },
      heroSub: L('X'),
      areaSnippet: L('X'),
    });
    expect(res.ok).toBe(false);
  });

  it('validates image type and size', () => {
    expect(validateImage('image/png', 1000)).toEqual({ ok: true, ext: 'png' });
    expect(validateImage('image/jpeg', 1000)).toEqual({ ok: true, ext: 'jpg' });
    expect(validateImage('image/gif', 1000).ok).toBe(false);
    expect(validateImage('image/png', MAX_IMAGE_BYTES + 1).ok).toBe(false);
    expect(validateImage('image/png', 0).ok).toBe(false);
  });

  it('upload action rejects a bad file type before touching storage', async () => {
    const file = new File([new Uint8Array(10)], 'bad.gif', {
      type: 'image/gif',
    });
    const fd = new FormData();
    fd.append('field', 'before');
    fd.append('file', file);
    const res = await uploadHomeImageAction(fd);
    expect(res).toEqual({ ok: false, reason: 'bad_type' });
  });

  it('setHomeImageUrl persists and the read returns it', async () => {
    await setHomeImageUrl(db, 'before', 'https://cdn.example/before.jpg');
    const c = await getHomepageContent(db, 'nl');
    expect(c?.beforeImageUrl).toBe('https://cdn.example/before.jpg');
    expect(c?.afterImageUrl).toBeNull();
  });
});
