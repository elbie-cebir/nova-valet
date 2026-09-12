import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './locale-switcher';

/**
 * Sticky top bar from the POC: brand wordmark, primary nav, locale switch and
 * a book CTA. Server component; the only client island is the locale switcher.
 *
 * "Nova Valet" is the product wordmark (a proper noun, deliberately not
 * localized). Nav labels come from the Nav namespace. Booking is B3, so the
 * CTA points at the catalog for now.
 */
export function SiteHeader() {
  const t = useTranslations('Nav');
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 5,
        padding: '10px 20px',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        background: 'rgba(11,12,10,.55)',
        borderBottom: '1px solid var(--nv-border)',
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Link
          href="/"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
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
              fontSize: 20,
              letterSpacing: '-.02em',
            }}
          >
            Nova&nbsp;Valet
          </span>
        </Link>

        <nav
          style={{
            display: 'flex',
            gap: 26,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--nv-muted)',
          }}
        >
          <Link href="/services" style={{ color: 'inherit' }}>
            {t('services')}
          </Link>
          <Link href="/prices" style={{ color: 'inherit' }}>
            {t('prices')}
          </Link>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LocaleSwitcher />
          <Link
            href="/book"
            style={{
              height: 40,
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 18px',
              borderRadius: 999,
              background: 'var(--nv-lime)',
              color: 'var(--nv-bg)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 14,
              boxShadow: '0 10px 30px -10px rgba(214,240,77,.7)',
            }}
          >
            {t('bookNow')}
          </Link>
        </div>
      </div>
    </header>
  );
}
