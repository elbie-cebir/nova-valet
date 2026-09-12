import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { signOutAction } from '@/app/[locale]/admin/actions';
import type { ReactNode } from 'react';

/**
 * Owner-admin chrome, matching the POC: a left sidebar on web (brand, nav with a
 * live booking-count badge, greyed future sections, a Stripe test-mode card,
 * locale switch + sign-out), and a sticky pill-tab top bar on phone. Server
 * component; sign-out posts to a locale-bound server action.
 */
export async function AdminShell({
  locale,
  ownerEmail,
  active,
  bookingCount,
  children,
}: {
  locale: string;
  ownerEmail: string;
  active: 'bookings' | 'slots';
  bookingCount: number;
  children: ReactNode;
}) {
  const t = await getTranslations('Admin');

  const Brand = ({ size = 20 }: { size?: number }) => (
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
    padding: '12px 14px',
    borderRadius: 12,
    border: 0,
    textAlign: 'left' as const,
    fontSize: 15,
    fontWeight: 600,
    background: isActive ? 'var(--nv-surface-2)' : 'transparent',
    color: isActive ? 'var(--nv-ink)' : 'var(--nv-muted)',
    width: '100%',
  });
  const pill = (isActive: boolean) => ({
    padding: '6px 14px',
    borderRadius: 999,
    border: 0,
    fontSize: 13,
    fontWeight: 600,
    background: isActive ? 'var(--nv-lime)' : 'transparent',
    color: isActive ? 'var(--nv-bg)' : 'var(--nv-muted)',
  });
  const soon = {
    padding: '12px 14px',
    color: 'var(--nv-faint)',
    fontSize: 15,
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
    <div className="nv-admin">
      {/* ── web sidebar ── */}
      <aside
        className="nv-admin-side"
        style={{
          flexDirection: 'column',
          gap: 28,
          padding: '24px 18px',
          borderRight: '1px solid var(--nv-border)',
          background: 'rgba(255,255,255,.02)',
        }}
      >
        <Brand />
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link href="/admin" style={navItem(active === 'bookings')}>
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
          <Link href="/admin/slots" style={navItem(active === 'slots')}>
            <span>{t('slots')}</span>
          </Link>
          <div style={soon}>
            {t('payments')}
            {soonTag}
          </div>
          <div style={soon}>
            {t('areaFees')}
            {soonTag}
          </div>
          <div style={soon}>
            {t('pricesAddons')}
            {soonTag}
          </div>
        </nav>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
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
      </aside>

      {/* ── content column (with phone top bar) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          className="nv-admin-top"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            padding: '10px 18px',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            backdropFilter: 'blur(20px)',
            background: 'rgba(11,12,10,.6)',
            borderBottom: '1px solid var(--nv-border)',
          }}
        >
          <Brand size={16} />
          <div
            style={{
              display: 'flex',
              gap: 4,
              background: 'var(--nv-surface-2)',
              borderRadius: 999,
              padding: 3,
            }}
          >
            <Link href="/admin" style={pill(active === 'bookings')}>
              {t('bookings')}
            </Link>
            <Link href="/admin/slots" style={pill(active === 'slots')}>
              {t('slots')}
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LocaleSwitcher />
            <form action={signOutAction.bind(null, locale)}>
              <button
                type="submit"
                style={{
                  background: 'none',
                  border: 0,
                  color: 'var(--nv-faint)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {t('signOut')}
              </button>
            </form>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
