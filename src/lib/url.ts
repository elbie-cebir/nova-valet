/** Absolute-URL + locale-path helpers (used by server actions, email, webhooks). */

export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

/** nl is the default locale (unprefixed); en/fr are prefixed. */
export function localePrefix(locale: string): string {
  return locale === 'nl' ? '' : `/${locale}`;
}

/** Absolute URL of the token-scoped guest booking view. */
export function bookingUrl(locale: string, token: string): string {
  return `${siteUrl()}${localePrefix(locale)}/booking/${token}`;
}
