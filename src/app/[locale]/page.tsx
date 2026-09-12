import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Home');

  return (
    <main
      style={{
        maxWidth: 1180,
        width: '100%',
        margin: '0 auto',
        padding: '56px 20px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div
        style={{
          fontSize: 12,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--nv-lime)',
          fontWeight: 600,
        }}
      >
        {t('heroKicker')}
      </div>
      <h1
        style={{
          fontSize: 'clamp(40px,6vw,78px)',
          lineHeight: 0.98,
          maxWidth: 720,
        }}
      >
        {t('heroTitle')}
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 'clamp(15px,1.4vw,19px)',
          lineHeight: 1.55,
          color: 'var(--nv-muted)',
          maxWidth: 480,
        }}
      >
        {t('heroSub')}
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        <Link
          href="/services"
          style={{
            height: 54,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 26px',
            borderRadius: 999,
            background: 'var(--nv-lime)',
            color: 'var(--nv-bg)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            boxShadow: '0 14px 40px -12px rgba(214,240,77,.8)',
          }}
        >
          {t('viewServices')}
        </Link>
        <Link
          href="/prices"
          style={{
            height: 54,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 22px',
            borderRadius: 999,
            background: 'var(--nv-surface-2)',
            border: '1px solid var(--nv-border-strong)',
            color: 'var(--nv-ink)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 15,
          }}
        >
          {t('viewPrices')}
        </Link>
      </div>
    </main>
  );
}
