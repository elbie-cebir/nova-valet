'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { redirect } from '@/i18n/navigation';
import { isOwnerEmail, getConfiguredOwnerEmail } from '@/lib/auth/owner';

const schema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
  locale: z.string(),
});

// On success this redirects (never returns); only failures resolve to a value.
export type SignInResult = { ok: false } | void;

/**
 * Sign the owner in with Supabase Auth. Fails closed: a bad credential OR a
 * valid Supabase user that is NOT the configured owner is rejected (and any
 * accidental session torn down). On success this redirects to the admin and
 * never returns.
 */
export async function signInAction(input: unknown): Promise<SignInResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) return { ok: false };

  // Only the owner may hold an admin session.
  if (!isOwnerEmail(data.user.email, getConfiguredOwnerEmail())) {
    await supabase.auth.signOut();
    return { ok: false };
  }

  redirect({ href: '/admin', locale: parsed.data.locale });
}
