import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import {
  getTiers,
  getServicePricesForTier,
  getDepositCents,
} from '@/lib/content/reads';
import { formatMoney } from '@/lib/format';
import { parseVehicleSize } from '@/lib/validation/params';

const wrap = {
  maxWidth: 900,
  width: '100%',
  margin: '0 auto',
  padding: '36px 20px 64px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 22,
};

export default async function PricesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Parse, don't trust: an unknown ?size falls back to the default tier.
  const { size } = await searchParams;
  const activeSize = parseVehicleSize(size);

  const t = await getTranslations('Prices');

  const [tiers, rows, depositCents] = await Promise.all([
    getTiers(locale),
    getServicePricesForTier(locale, activeSize),
    getDepositCents(),
  ]);
  const activeTier = tiers.find((tier) => tier.key === activeSize);

  return (
    <main style={wrap}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 style={{ fontSize: 'clamp(34px,4.5vw,56px)', lineHeight: 1 }}>
          {t('title')}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.5,
            color: 'var(--nv-muted)',
            maxWidth: 560,
          }}
        >
          {t('subtitle')}
        </p>
      </div>

      {/* tier tabs — each is a server-side link that re-renders with ?size= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${tiers.length},1fr)`,
          gap: 6,
          background: 'var(--nv-surface-2)',
          border: '1px solid var(--nv-border)',
          padding: 4,
          borderRadius: 16,
        }}
      >
        {tiers.map((tier) => {
          const isActive = tier.key === activeSize;
          return (
            <Link
              key={tier.id}
              href={{ pathname: '/prices', query: { size: tier.key } }}
              aria-current={isActive ? 'true' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: '10px 6px',
                borderRadius: 12,
                background: isActive ? 'var(--nv-lime)' : 'transparent',
                color: isActive ? 'var(--nv-bg)' : 'var(--nv-ink)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 14,
                textAlign: 'center',
              }}
            >
              <span>{tier.label}</span>
              <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.7 }}>
                {tier.desc}
              </span>
            </Link>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              borderRadius: 16,
              padding: '16px 18px',
              background: 'var(--nv-surface)',
              border: '1px solid var(--nv-border)',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 18,
                }}
              >
                {s.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
                {t('slot2h')}
              </div>
            </div>
            <div
              className="nv-mono"
              style={{ fontSize: 18, color: 'var(--nv-lime)' }}
            >
              {formatMoney(s.amountCents, s.currency, locale)}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          borderRadius: 20,
          padding: '20px 22px',
          background: 'var(--nv-surface)',
          border: '1px solid var(--nv-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--nv-muted)' }}>{t('depositAt')}</span>
          <strong className="nv-mono" style={{ fontWeight: 500 }}>
            {formatMoney(depositCents, 'EUR', locale)} {t('flat')}
          </strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--nv-muted)' }}>{t('travelFee')}</span>
          <strong>{t('byPostcode')}</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--nv-muted)' }}>{t('balance')}</span>
          <strong>{t('balanceOnline')}</strong>
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--nv-muted)',
            borderTop: '1px solid var(--nv-border)',
            paddingTop: 10,
          }}
        >
          {t('note')}
        </div>
      </div>

      <Link
        href="/book"
        style={{
          height: 54,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 999,
          background: 'var(--nv-lime)',
          color: 'var(--nv-bg)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          boxShadow: '0 14px 40px -12px rgba(214,240,77,.8)',
        }}
      >
        {t('bookFor')} {activeTier?.label ?? ''}
      </Link>
    </main>
  );
}
