import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getDb } from '@/lib/data/db.server';
import { getServicesWithFromPrice, getAddOns } from '@/lib/data/catalog';
import { formatMoney } from '@/lib/format';

const wrap = {
  maxWidth: 1180,
  width: '100%',
  margin: '0 auto',
  padding: '36px 20px 64px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 24,
};

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Services');
  const tc = await getTranslations();

  const db = await getDb();
  const [services, addons] = await Promise.all([
    getServicesWithFromPrice(db),
    getAddOns(db),
  ]);

  return (
    <main style={wrap}>
      <div
        style={{
          maxWidth: 640,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <h1 style={{ fontSize: 'clamp(34px,4.5vw,56px)', lineHeight: 1 }}>
          {t('title')}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.5,
            color: 'var(--nv-muted)',
          }}
        >
          {t('subtitle')}
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))',
          gap: 12,
        }}
      >
        {services.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              borderRadius: 20,
              padding: 22,
              background: 'var(--nv-surface)',
              border: '1px solid var(--nv-border)',
              backdropFilter: 'blur(20px)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 21,
                  letterSpacing: '-.02em',
                }}
              >
                {tc(s.nameKey)}
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--nv-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('from')}{' '}
                <span className="nv-mono">
                  {formatMoney(s.fromCents, s.currency, locale)}
                </span>
              </span>
            </div>
            <div
              style={{
                fontSize: 14,
                color: 'var(--nv-muted)',
                lineHeight: 1.5,
                flex: 1,
              }}
            >
              {tc(s.descriptionKey)}
            </div>
            <Link
              href="/book"
              style={{
                alignSelf: 'flex-start',
                height: 44,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 20px',
                borderRadius: 999,
                background: 'var(--nv-lime)',
                color: 'var(--nv-bg)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {t('book')}
            </Link>
          </div>
        ))}
      </div>

      <div
        style={{
          borderRadius: 24,
          padding: 24,
          background: 'var(--nv-surface)',
          border: '1px solid var(--nv-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--nv-muted)',
            fontWeight: 600,
          }}
        >
          {t('addons')}
        </div>
        {addons.map((a) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: '1px solid var(--nv-border)',
              fontSize: 15,
            }}
          >
            <span>{tc(a.nameKey)}</span>
            <span
              className="nv-mono"
              style={{ fontSize: 13, color: 'var(--nv-muted)' }}
            >
              +{formatMoney(a.amountCents, 'EUR', locale)}
            </span>
          </div>
        ))}
        <div
          className="nv-mono"
          style={{ fontSize: 11, color: 'var(--nv-faint)' }}
        >
          {t('addonNote')}
        </div>
      </div>
    </main>
  );
}
