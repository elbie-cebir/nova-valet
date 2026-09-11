/**
 * Centralised, validated access to the public Supabase env vars. Throwing here
 * gives a clear failure at the call site instead of an opaque client error.
 *
 * The service-role key is intentionally NOT read here — it must never reach a
 * browser bundle. A privileged admin client will be added in a later step and
 * read `SUPABASE_SERVICE_ROLE_KEY` server-side only.
 */
export function getPublicSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!anonKey) {
    throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  return { url, anonKey };
}
