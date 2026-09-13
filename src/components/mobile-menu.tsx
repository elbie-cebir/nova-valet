'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './locale-switcher';
import { Drawer, DrawerToggle } from './drawer';

/**
 * Phone navigation: a hamburger in the top bar that slides a drawer in from the
 * right with the nav links, locale switch and the book CTA. The desktop nav is
 * hidden below the breakpoint (see `.nv-nav-mobile` in globals.css); this island
 * supplies the tap-to-open behaviour it replaces. Every label is `t()`.
 */
export function MobileMenu() {
  const t = useTranslations('Nav');
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <DrawerToggle
        open={open}
        onClick={() => setOpen((v) => !v)}
        label={open ? t('close') : t('menu')}
      />

      <Drawer open={open} onClose={close} side="right" label={t('menu')}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '10px 20px 28px',
            minHeight: '100%',
          }}
        >
          {/* Drawer top row: brand + close. */}
          <div
            style={{
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  background: 'var(--nv-lime)',
                  borderRadius: 3,
                  boxShadow: '0 0 16px rgba(214,240,77,.7)',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 18,
                  letterSpacing: '-.02em',
                }}
              >
                Nova&nbsp;Valet
              </span>
            </div>
            <DrawerToggle open onClick={close} label={t('close')} />
          </div>

          {/* Nav links, large and tappable. */}
          <nav
            style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}
          >
            {(
              [
                ['/services', t('services')],
                ['/prices', t('prices')],
                ['/find', t('myBooking')],
              ] as const
            ).map(([href, labelText]) => (
              <Link
                key={href}
                href={href}
                onClick={close}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 22,
                  letterSpacing: '-.02em',
                  padding: '16px 2px',
                  borderBottom: '1px solid var(--nv-border)',
                }}
              >
                {labelText}
              </Link>
            ))}
          </nav>

          {/* Locale + primary CTA pinned to the bottom. */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex' }}>
              <LocaleSwitcher />
            </div>
            <Link
              href="/book"
              onClick={close}
              style={{
                height: 52,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                background: 'var(--nv-lime)',
                color: 'var(--nv-bg)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 16,
                boxShadow: '0 10px 30px -10px rgba(214,240,77,.7)',
              }}
            >
              {t('bookNow')}
            </Link>
          </div>
        </div>
      </Drawer>
    </>
  );
}
