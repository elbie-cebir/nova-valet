import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getServicesWithFromPrice, getDepositCents } from '@/lib/content/reads';
import { formatMoney } from '@/lib/format';

const section = {
  maxWidth: 1180,
  width: '100%',
  margin: '0 auto',
  padding: '0 20px',
} as const;

const glassCard = {
  borderRadius: 24,
  padding: 26,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 14,
};

const primaryCta = {
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
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('Home');
  const [services, depositCents] = await Promise.all([
    getServicesWithFromPrice(locale),
    getDepositCents(),
  ]);
  const money = (c: number, cur = 'EUR') => formatMoney(c, cur, locale);
  const ownerNumber = process.env.NEXT_PUBLIC_WHATSAPP_OWNER_NUMBER;

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* ── hero ── */}
      <section
        style={{
          ...section,
          paddingTop: 40,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,400px),1fr))',
          gap: 36,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
              letterSpacing: '-.035em',
              margin: 0,
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
          <div
            style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}
          >
            <Link href="/book" style={primaryCta}>
              {t('bookNow')}
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
          <div
            style={{
              display: 'flex',
              gap: 22,
              flexWrap: 'wrap',
              marginTop: 10,
              fontSize: 13,
              color: 'var(--nv-muted)',
            }}
          >
            <span>
              <strong style={{ color: 'var(--nv-ink)' }}>{t('fact1b')}</strong>{' '}
              {t('fact1')}
            </span>
            <span>
              <strong style={{ color: 'var(--nv-ink)' }}>{t('fact2b')}</strong>{' '}
              {t('fact2')}
            </span>
            <span>
              <strong style={{ color: 'var(--nv-ink)' }}>{t('fact3b')}</strong>{' '}
              {t('fact3')}
            </span>
          </div>
        </div>

        {/* before / after visual */}
        <div
          style={{
            height: 'clamp(300px,42vw,520px)',
            borderRadius: 28,
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid var(--nv-border-strong)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,.15),0 40px 80px -40px rgba(0,0,0,.9)',
            background:
              'repeating-linear-gradient(135deg,rgba(255,255,255,.04) 0 12px,rgba(255,255,255,.07) 12px 24px)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
            }}
          >
            <div
              style={{
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderRight: '2px solid var(--nv-lime)',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'var(--nv-muted)',
                }}
              >
                {t('before')}
              </span>
              <span
                className="nv-mono"
                style={{ fontSize: 11, color: 'var(--nv-faint)' }}
              >
                {t('beforeSlot')}
              </span>
            </div>
            <div
              style={{
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                background:
                  'repeating-linear-gradient(135deg,rgba(214,240,77,.10) 0 12px,rgba(214,240,77,.16) 12px 24px)',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  color: 'var(--nv-lime)',
                }}
              >
                {t('after')}
              </span>
              <span
                className="nv-mono"
                style={{ fontSize: 11, color: 'var(--nv-muted)' }}
              >
                {t('afterSlot')}
              </span>
            </div>
          </div>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%,-50%)',
              width: 52,
              height: 52,
              borderRadius: 999,
              background: 'var(--nv-lime)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              color: 'var(--nv-bg)',
              boxShadow: '0 10px 30px rgba(214,240,77,.5)',
            }}
          >
            ‹›
          </div>
        </div>
      </section>

      {/* ── services preview ── */}
      <section
        style={{
          ...section,
          paddingTop: 56,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(26px,3vw,40px)',
              letterSpacing: '-.03em',
              margin: 0,
            }}
          >
            {t('servicesTitle')}
          </h2>
          <Link
            href="/prices"
            style={{
              color: 'var(--nv-lime)',
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'underline',
            }}
          >
            {t('allPrices')}
          </Link>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,160px),1fr))',
            gap: 12,
          }}
        >
          {services.map((s) => (
            <Link
              key={s.id}
              href="/book"
              style={{
                ...glassCard,
                gap: 10,
                padding: 18,
                background: 'var(--nv-surface)',
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: 'var(--nv-lime)',
                  boxShadow: '0 0 14px rgba(214,240,77,.7)',
                }}
              />
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 17,
                    letterSpacing: '-.01em',
                  }}
                >
                  {s.name}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--nv-muted)',
                    marginTop: 4,
                  }}
                >
                  {t('from')}{' '}
                  <span className="nv-mono">
                    {money(s.fromCents, s.currency)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── how it works + area + already-booked ── */}
      <section
        style={{
          ...section,
          paddingTop: 56,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))',
          gap: 16,
        }}
      >
        <div style={glassCard}>
          <h3 style={{ fontSize: 24, letterSpacing: '-.02em', margin: 0 }}>
            {t('howTitle')}
          </h3>
          {(
            [
              ['1', t('how1t'), t('how1d')],
              ['2', t('how2t', { deposit: money(depositCents) }), t('how2d')],
              ['3', t('how3t'), t('how3d')],
            ] as const
          ).map(([n, title, desc], i) => (
            <div
              key={n}
              style={{
                display: 'flex',
                gap: 14,
                padding: '12px 0',
                borderBottom: i < 2 ? '1px solid var(--nv-border)' : 'none',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: 'var(--nv-lime)',
                  width: 24,
                }}
              >
                {n}
              </span>
              <div style={{ fontSize: 15, lineHeight: 1.45 }}>
                <strong>{title}</strong>
                <div style={{ color: 'var(--nv-muted)' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={glassCard}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'var(--nv-muted)',
                fontWeight: 600,
              }}
            >
              {t('areaTitle')}
            </div>
            <div
              style={{
                fontSize: 20,
                letterSpacing: '-.02em',
                lineHeight: 1.25,
              }}
            >
              {t('areaText')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder={t('postcodePh')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: 48,
                  borderRadius: 12,
                  background: 'var(--nv-surface-2)',
                  border: '1px solid var(--nv-border-strong)',
                  color: 'var(--nv-ink)',
                  padding: '0 14px',
                  fontSize: 15,
                }}
              />
              <Link
                href="/book"
                style={{
                  height: 48,
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 18px',
                  borderRadius: 12,
                  background: 'var(--nv-ink)',
                  color: 'var(--nv-bg)',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {t('check')}
              </Link>
            </div>
          </div>

          <div
            style={{
              borderRadius: 24,
              padding: 26,
              background:
                'linear-gradient(135deg,rgba(214,240,77,.95),rgba(190,220,60,.9))',
              color: 'var(--nv-bg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxShadow: '0 30px 60px -30px rgba(214,240,77,.6)',
            }}
          >
            <div
              style={{
                fontSize: 20,
                letterSpacing: '-.02em',
                lineHeight: 1.25,
              }}
            >
              {t('alreadyBooked')}
            </div>
            <Link
              href="/find"
              style={{
                alignSelf: 'flex-start',
                height: 46,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 20px',
                borderRadius: 999,
                background: 'var(--nv-bg)',
                color: 'var(--nv-ink)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {t('findBooking')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── closing band + footer ── */}
      <section style={{ ...section, paddingTop: 56 }}>
        <div
          style={{
            borderRadius: 28,
            padding: 'clamp(28px,4vw,56px)',
            background: 'var(--nv-surface)',
            border: '1px solid var(--nv-border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 20,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3
            style={{
              fontSize: 'clamp(30px,4vw,52px)',
              letterSpacing: '-.035em',
              lineHeight: 1,
              margin: 0,
            }}
          >
            {t('readyTitle')}
          </h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/book" style={primaryCta}>
              {t('bookSlot')}
            </Link>
            {ownerNumber && (
              <a
                href={`https://wa.me/${ownerNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  height: 54,
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0 22px',
                  borderRadius: 999,
                  background: 'var(--nv-wa)',
                  color: '#04140b',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                {t('askWA')}
              </a>
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 12,
            color: 'var(--nv-faint)',
            marginTop: 20,
          }}
        >
          <span>{t('poweredBy')}</span>
          <Link href="/admin" style={{ color: 'var(--nv-faint)' }}>
            {t('owner')}
          </Link>
        </div>
      </section>
    </div>
  );
}
