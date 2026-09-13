'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { locales, defaultLocale } from '@/i18n/routing';

/**
 * NL / EN / FR pill switcher.
 *
 * We build the target URL explicitly rather than using next-intl's
 * `router.replace(pathname, { locale })`: under `localePrefix: 'as-needed'` the
 * default locale (nl) lives at an UNPREFIXED path, and next-intl's locale-aware
 * replace no-ops when switching TO the default from a prefixed locale — so you
 * could never get back to Dutch. We read the RAW pathname from next/navigation,
 * strip any en/fr prefix ourselves, then re-prefix for the target locale (bare
 * for nl), set NEXT_LOCALE (harmless while detection is off, correct if it's
 * ever on), and navigate with the plain router. All copy here is locale codes,
 * not translatable strings.
 */
export function LocaleSwitcher() {
  const active = useLocale();
  const fullPath = usePathname();
  const router = useRouter();

  const switchTo = (loc: string) => {
    if (loc === active) return;
    // Strip a leading /en or /fr to get the locale-agnostic path.
    const seg = fullPath.split('/')[1];
    const bare =
      seg === 'en' || seg === 'fr'
        ? fullPath.slice(seg.length + 1) || '/'
        : fullPath;
    const target =
      loc === defaultLocale ? bare : `/${loc}${bare === '/' ? '' : bare}`;
    document.cookie = `NEXT_LOCALE=${loc};path=/;max-age=31536000;samesite=lax`;
    router.replace(target);
    router.refresh();
  };

  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--nv-surface-2)',
        border: '1px solid var(--nv-border-strong)',
        borderRadius: 999,
        padding: 3,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {locales.map((loc) => {
        const isActive = loc === active;
        return (
          <button
            key={loc}
            onClick={() => switchTo(loc)}
            aria-pressed={isActive}
            style={{
              border: 0,
              borderRadius: 999,
              padding: '5px 9px',
              background: isActive ? 'var(--nv-ink)' : 'transparent',
              color: isActive ? 'var(--nv-bg)' : 'var(--nv-muted)',
            }}
          >
            {loc.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
