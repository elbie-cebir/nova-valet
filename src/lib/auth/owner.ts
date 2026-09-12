import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface Owner {
  email: string;
}

/**
 * The single security decision behind the whole admin: is this authenticated
 * email the owner? Pure and fail-closed — a missing user email OR a missing
 * configured owner email OR any mismatch returns false. Comparison is
 * case-insensitive and trimmed. (Single owner-operator; no self-signup.)
 */
export function isOwnerEmail(
  email: string | null | undefined,
  ownerEmail: string | null | undefined,
): boolean {
  const a = email?.trim().toLowerCase();
  const b = ownerEmail?.trim().toLowerCase();
  if (!a || !b) return false;
  return a === b;
}

/** The configured owner address, or null if unset (→ admin is inaccessible). */
export function getConfiguredOwnerEmail(): string | null {
  const v = process.env.OWNER_EMAIL?.trim();
  return v ? v : null;
}

/**
 * Resolve the currently authenticated Supabase user and return `{ email }` ONLY
 * if it is the owner; otherwise null. `getUser()` re-validates the JWT with
 * Supabase, so this cannot be spoofed by a forged cookie.
 */
export async function getAuthenticatedOwner(): Promise<Owner | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (isOwnerEmail(user?.email, getConfiguredOwnerEmail())) {
    return { email: user!.email! };
  }
  return null;
}

/**
 * The choke point every admin page and action calls first. If the caller is not
 * the authenticated owner it 404s — not-found, never a leak (an outsider can't
 * even tell the admin exists). The resolver is injectable so the guard's
 * fail-closed behaviour is unit-testable without a Supabase runtime.
 */
export async function requireOwner(
  resolve: () => Promise<Owner | null> = getAuthenticatedOwner,
): Promise<Owner> {
  const owner = await resolve();
  if (!owner) notFound();
  return owner;
}
