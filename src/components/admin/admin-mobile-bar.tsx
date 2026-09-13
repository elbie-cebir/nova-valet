'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Drawer, DrawerToggle } from '@/components/drawer';
import { signOutAction } from '@/app/[locale]/admin/actions';

/**
 * Phone chrome for the owner admin: a sticky top bar (brand + hamburger) that
 * slides the sidebar nav in from the right (matching the hamburger's side, like
 * the customer menu) — the same items as the web sidebar
 * (bookings with live count, slots, greyed future sections, Stripe test card,
 * locale + sign-out). Shown below the sidebar breakpoint via `.nv-admin-top`;
 * the web sidebar (`.nv-admin-side`) takes over above it. All copy is `t()`.
 */
export function AdminMobileBar({
  locale,
  ownerEmail,
  active,
  bookingCount,
}: {
  locale: string;
  ownerEmail: string;
  active:
    | 'bookings'
    | 'slots'
    | 'catalog'
    | 'area'
    | 'homepage'
    | 'reviews'
    | 'legal';
  bookingCount: number;
}) {
  const t = useTranslations('Admin');
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const Brand = ({ size = 16 }: { size?: number }) => (
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
          fontSize: size,
          letterSpacing: '-.02em',
        }}
      >
        Nova&nbsp;Valet
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'var(--nv-faint)',
          marginLeft: 2,
        }}
      >
        {t('owner')}
      </span>
    </div>
  );

  const navItem = (isActive: boolean) => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 14px',
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 600,
    background: isActive ? 'var(--nv-surface-2)' : 'transparent',
    color: isActive ? 'var(--nv-ink)' : 'var(--nv-muted)',
    width: '100%',
  });
  const soon = {
    padding: '14px 14px',
    color: 'var(--nv-faint)',
    fontSize: 16,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };
  const soonTag = (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.08em',
        textTransform: 'uppercase' as const,
        color: 'var(--nv-faint)',
        border: '1px solid var(--nv-border)',
        borderRadius: 999,
        padding: '2px 7px',
      }}
    >
      {t('soon')}
    </span>
  );

  return (
    <div
      className="nv-admin-top"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        padding: '10px 18px',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(11,12,10,.6)',
        borderBottom: '1px solid var(--nv-border)',
      }}
    >
      <Brand />
      <DrawerToggle
        open={open}
        onClick={() => setOpen((v) => !v)}
        label={open ? t('closeMenu') : t('openMenu')}
      />

      <Drawer open={open} onClose={close} side="right" label={t('openMenu')}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            padding: '18px 16px 24px',
            minHeight: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Brand size={18} />
            <DrawerToggle open onClick={close} label={t('closeMenu')} />
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Link
              href="/admin"
              onClick={close}
              style={navItem(active === 'bookings')}
            >
              <span>{t('bookings')}</span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  background: 'var(--nv-lime)',
                  color: 'var(--nv-bg)',
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {bookingCount}
              </span>
            </Link>
            <Link
              href="/admin/slots"
              onClick={close}
              style={navItem(active === 'slots')}
            >
              <span>{t('slots')}</span>
            </Link>
            <Link
              href="/admin/catalog"
              onClick={close}
              style={navItem(active === 'catalog')}
            >
              <span>{t('pricesAddons')}</span>
            </Link>
            <Link
              href="/admin/area"
              onClick={close}
              style={navItem(active === 'area')}
            >
              <span>{t('areaFees')}</span>
            </Link>
            <div style={soon}>
              {t('payments')}
              {soonTag}
            </div>
          </nav>

          <div
            style={{
              marginTop: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                background: 'var(--nv-surface)',
                border: '1px solid var(--nv-border)',
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--nv-muted)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <strong style={{ color: 'var(--nv-ink)' }}>Stripe</strong>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 5,
                    background: 'rgba(245,192,138,.15)',
                    color: 'var(--nv-warn)',
                  }}
                >
                  {t('stripeTest')}
                </span>
              </div>
              {t('stripeSwap')}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <LocaleSwitcher />
              <form action={signOutAction.bind(null, locale)}>
                <button
                  type="submit"
                  style={{
                    background: 'none',
                    border: 0,
                    color: 'var(--nv-faint)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {t('signOut')}
                </button>
              </form>
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--nv-faint)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {ownerEmail}
            </div>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
