import { describe, it, expect } from 'vitest';
import { routing, locales, defaultLocale } from '@/i18n/routing';

/**
 * Locale routing contract. The spec requires '/' → nl, '/en' and '/fr' for the
 * others (localePrefix 'as-needed'). Detection MUST stay off: with 'as-needed'
 * the default locale sits at '/', so honouring the NEXT_LOCALE cookie would
 * bounce '/' back to the previously-selected locale and make switching TO Dutch
 * impossible. This test guards that regression.
 */
describe('i18n routing config', () => {
  it('serves nl at / and prefixes en/fr', () => {
    expect(defaultLocale).toBe('nl');
    expect([...locales]).toEqual(['nl', 'en', 'fr']);
    expect(routing.localePrefix).toBe('as-needed');
  });

  it('has locale detection disabled so switching to the default locale works', () => {
    expect(routing.localeDetection).toBe(false);
  });
});
