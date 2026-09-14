import { describe, it, expect, afterEach } from 'vitest';
import { routing, locales, defaultLocale } from '@/i18n/routing';
import { getPublicSupabaseEnv } from '@/lib/supabase/env';

describe('B0 foundation smoke', () => {
  it('configures nl as default and en/fr as supported locales', () => {
    expect(defaultLocale).toBe('nl');
    expect([...locales].sort()).toEqual(['en', 'fr', 'nl']);
    expect(routing.defaultLocale).toBe('nl');
  });

  it('ships a message catalogue for every locale with the sample key', async () => {
    for (const locale of locales) {
      const messages = (await import(`../messages/${locale}.json`)).default;
      // Canary key that is actually rendered (the primary nav CTA).
      expect(typeof messages.Nav.bookNow).toBe('string');
      expect(messages.Nav.bookNow.length).toBeGreaterThan(0);
    }
  });

  it('reads validated public Supabase env when present', () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    expect(getPublicSupabaseEnv()).toEqual({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key',
    });

    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevKey;
  });

  it('throws a clear error when public Supabase env is missing', () => {
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    expect(() => getPublicSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);

    if (prevUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
  });
});
