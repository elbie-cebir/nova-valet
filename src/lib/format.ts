import { LOCALES } from '@/i18n/routing';

/**
 * Format an integer-cents amount as a localized currency string.
 * Money is stored as cents everywhere; formatting is the only place it becomes
 * a decimal, and only for display.
 */
export function formatMoney(
  amountCents: number,
  currency: string,
  locale: string,
): string {
  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
  return new Intl.NumberFormat(bcp47, {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}
