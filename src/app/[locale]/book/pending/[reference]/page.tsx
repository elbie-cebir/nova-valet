import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getDb } from '@/lib/data/db.server';
import { getBookingByReference } from '@/lib/data/booking';
import { formatMoney } from '@/lib/format';
import { LOCALES } from '@/i18n/routing';

const card = {
  borderRadius: 20,
  padding: 22,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 10,
};
const row = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  fontSize: 14,
};

export default async function BookingPendingPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('BookingPending');
  const tc = await getTranslations();

  const db = await getDb();
  const booking = await getBookingByReference(db, reference);

  if (!booking) {
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px' }}>
        <h1 style={{ fontSize: 28 }}>{t('notFound')}</h1>
      </main>
    );
  }

  const money = (c: number) => formatMoney(c, 'EUR', locale);
  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
  const start = new Date(booking.slotStartAt);
  const end = new Date(booking.slotEndAt);
  const whenText = `${new Intl.DateTimeFormat(bcp47, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(start)} · ${new Intl.DateTimeFormat(bcp47, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(start)}–${new Intl.DateTimeFormat(bcp47, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(end)}`;
  const heldText = booking.heldUntil
    ? new Intl.DateTimeFormat(bcp47, {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(booking.heldUntil))
    : null;

  return (
    <main
      style={{
        maxWidth: 560,
        width: '100%',
        margin: '0 auto',
        padding: '36px 20px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 999,
          background: 'rgba(245,192,138,.16)',
          border: '1px solid var(--nv-warn)',
          color: 'var(--nv-warn)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        ⏳
      </div>
      <h1 style={{ fontSize: 'clamp(30px,4vw,44px)', lineHeight: 1.02 }}>
        {t('title')}
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 15,
          color: 'var(--nv-muted)',
          lineHeight: 1.55,
        }}
      >
        {t('sub')}
      </p>

      <div style={card}>
        <div style={row}>
          <span style={{ color: 'var(--nv-muted)' }}>{t('reference')}</span>
          <strong className="nv-mono">{booking.reference}</strong>
        </div>
        <div style={row}>
          <span style={{ color: 'var(--nv-muted)' }}>{t('service')}</span>
          <strong>
            {tc(booking.serviceNameKey)} · {tc(booking.tierLabelKey)}
          </strong>
        </div>
        <div style={row}>
          <span style={{ color: 'var(--nv-muted)' }}>{t('when')}</span>
          <strong style={{ textAlign: 'right' }}>{whenText}</strong>
        </div>
        <div style={row}>
          <span style={{ color: 'var(--nv-muted)' }}>{t('where')}</span>
          <strong style={{ textAlign: 'right' }}>
            {booking.address}, {booking.postcode}
          </strong>
        </div>
        {booking.addOns.map((a) => (
          <div style={{ ...row, color: 'var(--nv-muted)' }} key={a.nameKey}>
            <span>{tc(a.nameKey)}</span>
            <span className="nv-mono">+{money(a.amountCents)}</span>
          </div>
        ))}
        {booking.travelFeeCents > 0 && (
          <div style={{ ...row, color: 'var(--nv-muted)' }}>
            <span>{tc('Booking.travelFee')}</span>
            <span className="nv-mono">{money(booking.travelFeeCents)}</span>
          </div>
        )}
        <div
          style={{
            ...row,
            borderTop: '1px solid var(--nv-border)',
            paddingTop: 10,
            fontWeight: 600,
          }}
        >
          <span>{t('total')}</span>
          <span className="nv-mono">{money(booking.totalCents)}</span>
        </div>
      </div>

      <div
        style={{
          borderRadius: 20,
          padding: 22,
          background:
            'linear-gradient(160deg,rgba(214,240,77,.16),rgba(214,240,77,.04))',
          border: '1px solid rgba(214,240,77,.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'var(--nv-lime)',
                fontWeight: 600,
              }}
            >
              {t('depositNow')}
            </div>
            <div
              className="nv-mono"
              style={{ fontSize: 32, lineHeight: 1, marginTop: 6 }}
            >
              {money(booking.depositCents)}
            </div>
          </div>
          <div
            style={{
              textAlign: 'right',
              fontSize: 13,
              color: 'var(--nv-muted)',
            }}
          >
            <span className="nv-mono">{money(booking.balanceCents)}</span>
            <br />
            {t('balanceLater')}
          </div>
        </div>
        {heldText && (
          <div style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
            {t('heldUntil')} <span className="nv-mono">{heldText}</span>
          </div>
        )}
      </div>

      {/* B4 wires the real deposit + provider method picker. Placeholder handoff. */}
      <button
        disabled
        style={{
          height: 54,
          borderRadius: 999,
          border: 0,
          background: 'var(--nv-surface-2)',
          color: 'var(--nv-faint)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          cursor: 'not-allowed',
        }}
      >
        {t('continueToPayment')}
      </button>
      <p
        style={{
          fontSize: 12,
          color: 'var(--nv-faint)',
          textAlign: 'center',
          margin: 0,
        }}
      >
        {t('b4Note')}
      </p>
    </main>
  );
}
