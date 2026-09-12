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
});
