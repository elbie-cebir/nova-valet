'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales } from '@/i18n/routing';

/**
 * NL / EN / FR pill switcher. A justified client leaf: it needs the current
 * pathname and router to swap locale in place. All copy here is the locale
 * codes themselves (not translatable), so there is no hardcoded display copy.
 */
export function LocaleSwitcher() {
  const active = useLocale();
  const pathname = usePathname();
  const router = useRouter();

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
            onClick={() => router.replace(pathname, { locale: loc })}
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
