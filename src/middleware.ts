import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { getPublicSupabaseEnv } from './lib/supabase/env';

const handleIntl = createIntlMiddleware(routing);

/**
 * One middleware, two jobs:
 *  1. next-intl handles locale detection / prefixing and produces the response.
 *  2. Supabase refreshes the auth session by reading the request cookies and
 *     writing any rotated tokens back onto that same response, so the owner's
 *     admin session doesn't silently expire mid-use. (@supabase/ssr pattern.)
 *
 * The Supabase client here uses the anon key + the user's cookies only — never
 * the service-role key.
 */
export default async function middleware(request: NextRequest) {
  const response = handleIntl(request);

  const { url, anonKey } = getPublicSupabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touch the session so an about-to-expire token is rotated onto the response.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Next.js internals (/_next, /_vercel)
  // - files with an extension (e.g. favicon.ico)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
