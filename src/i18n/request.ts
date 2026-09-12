import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import { BUSINESS_TIMEZONE } from '@/config/constants';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // All times render in the business timezone, not the viewer's. (ADR-015)
    timeZone: BUSINESS_TIMEZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
