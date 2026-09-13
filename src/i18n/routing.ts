import { defineRouting } from 'next-intl/routing';

export const locales = ['nl', 'en', 'fr'] as const;
export const defaultLocale = 'nl' as const;

export type Locale = (typeof locales)[number];

/** BCP-47 regional tags per locale, used for number/currency/date formatting. */
export const LOCALES: Record<Locale, string> = {
  nl: 'nl-BE',
  en: 'en-GB',
  fr: 'fr-BE',
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  // 'nl' is served from '/', 'en'/'fr' are prefixed. Change to 'always' to
  // force a prefix on every locale.
  localePrefix: 'as-needed',
  // The URL path is the single source of truth for locale. Detection is OFF on
  // purpose: with 'as-needed' the default locale (nl) lives at '/', so if the
  // middleware honoured the NEXT_LOCALE cookie it would bounce '/' back to the
  // previously-selected locale — making it impossible to switch *to* Dutch from
  // en/fr. Switching is driven solely by the locale switcher navigating to the
  // target path.
  localeDetection: false,
});
