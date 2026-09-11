import { createBrowserClient } from '@supabase/ssr';
import { getPublicSupabaseEnv } from './env';

/**
 * Browser Supabase client. Uses the anon (publishable) key only — never the
 * service role key. Safe to call from Client Components.
 */
export function createClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
