import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isOwnerEmail, requireOwner } from '@/lib/auth/owner';

describe('owner authorization [fails closed]', () => {
  it('matches the configured owner case-insensitively and trimmed', () => {
    expect(isOwnerEmail('owner@nova.be', 'owner@nova.be')).toBe(true);
    expect(isOwnerEmail('Owner@Nova.BE', 'owner@nova.be')).toBe(true);
    expect(isOwnerEmail('  owner@nova.be  ', 'owner@nova.be')).toBe(true);
  });

  it('denies a non-owner email', () => {
    expect(isOwnerEmail('stranger@evil.com', 'owner@nova.be')).toBe(false);
  });

  it('fails closed when either side is missing (misconfig or no session)', () => {
    expect(isOwnerEmail(null, 'owner@nova.be')).toBe(false);
    expect(isOwnerEmail(undefined, 'owner@nova.be')).toBe(false);
    expect(isOwnerEmail('', 'owner@nova.be')).toBe(false);
    expect(isOwnerEmail('owner@nova.be', null)).toBe(false);
    expect(isOwnerEmail('owner@nova.be', '')).toBe(false);
    expect(isOwnerEmail(null, null)).toBe(false);
  });

  it('requireOwner returns the owner when the resolver says so', async () => {
    const owner = await requireOwner(async () => ({ email: 'owner@nova.be' }));
    expect(owner.email).toBe('owner@nova.be');
  });

  it('requireOwner 404s (not-found, no leak) for a non-owner / no session', async () => {
    // next/navigation notFound() throws a special error; the guard must throw
    // rather than fall through and expose anything.
    await expect(requireOwner(async () => null)).rejects.toThrow();
  });
});

describe('every admin route + action is guarded by requireOwner', () => {
  const ADMIN_DIR = join(process.cwd(), 'src', 'app', '[locale]', 'admin');

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(p));
      else out.push(p);
    }
    return out;
  }

  it('guards every page and every server-action file', () => {
    const files = walk(ADMIN_DIR).filter(
      (f) => f.endsWith('page.tsx') || f.endsWith('actions.ts'),
    );
    // Sanity: the admin surface exists.
    expect(files.length).toBeGreaterThan(0);

    const unguarded = files.filter((f) => {
      const src = readFileSync(f, 'utf8');
      // The login page is the ONLY admin route reachable by an unauthenticated
      // visitor; everything else must call the guard.
      if (f.endsWith(join('login', 'page.tsx'))) return false;
      if (f.endsWith(join('login', 'actions.ts'))) return false;
      return !src.includes('requireOwner(');
    });
    expect(unguarded).toEqual([]);
  });
});
