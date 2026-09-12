import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { signOutAction } from '@/app/[locale]/admin/actions';
import type { ReactNode } from 'react';

/**
 * Owner-admin chrome: a toolbar with the two sections and a sign-out control,
 * plus the page body. Server component; the sign-out button posts to a server
 * action bound to the current locale.
 */
export async function AdminShell({
  locale,
  ownerEmail,
  children,
}: {
  locale: string;
  ownerEmail: string;
  children: ReactNode;
}) {
  const t = await getTranslations('Admin');

  return (
    <div
      style={{
        maxWidth: 1180,
        width: '100%',
        margin: '0 auto',
        padding: '20px 20px 64px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
          paddingBottom: 16,
          marginBottom: 20,
          borderBottom: '1px solid var(--nv-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span
            style={{
              fontSize: 12,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'var(--nv-lime)',
              fontWeight: 700,
            }}
          >
            {t('brand')}
          </span>
          <nav
            style={{ display: 'flex', gap: 18, fontSize: 14, fontWeight: 500 }}
          >
            <Link href="/admin" style={{ color: 'var(--nv-muted)' }}>
              {t('nav.bookings')}
            </Link>
            <Link href="/admin/slots" style={{ color: 'var(--nv-muted)' }}>
              {t('nav.slots')}
            </Link>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--nv-faint)' }}>
            {ownerEmail}
          </span>
          <form action={signOutAction.bind(null, locale)}>
            <button
              type="submit"
              style={{
                height: 34,
                padding: '0 14px',
                borderRadius: 999,
                border: '1px solid var(--nv-border-strong)',
                background: 'transparent',
                color: 'var(--nv-ink)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {t('nav.signOut')}
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
