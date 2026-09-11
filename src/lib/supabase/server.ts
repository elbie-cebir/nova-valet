import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPublicSupabaseEnv } from './env';

/**
 * Server Supabase client bound to the request cookie store. Use in Server
 * Components, Route Handlers, and Server Actions. Uses the anon key and the
 * user's session — this is NOT the privileged/service-role client.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `setAll` can be called from a Server Component where cookies are
          // read-only. Safe to ignore when middleware refreshes the session.
        }
      },
    },
  });
}
