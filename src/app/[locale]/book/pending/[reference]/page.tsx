import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getDb } from '@/lib/data/db.server';
import { getBookingByReference } from '@/lib/data/booking';
import { formatMoney } from '@/lib/format';
import { LOCALES } from '@/i18n/routing';
import { BUSINESS_TIMEZONE } from '@/config/constants';
import { PaymentPicker } from '@/components/booking/payment-picker';

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
  const tp = await getTranslations('Checkout');
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
  const dateFmt = new Intl.DateTimeFormat(bcp47, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: BUSINESS_TIMEZONE,
  });
  const timeFmt = new Intl.DateTimeFormat(bcp47, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  });
  const whenText = `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
  const heldText = booking.heldUntil
    ? timeFmt.format(new Date(booking.heldUntil))
    : null;

  const isPending = booking.status === 'pending_deposit';
  const isConfirmed = booking.status === 'confirmed';
  const balanceDue =
    isConfirmed && booking.balancePaidAt === null && booking.balanceCents > 0;
  const fullyPaid =
    isConfirmed &&
    (booking.balancePaidAt !== null || booking.balanceCents === 0);

  const heading = isPending
    ? { icon: '⏳', warn: true, title: t('title'), sub: t('sub') }
    : isConfirmed
      ? {
          icon: '✓',
          warn: false,
          title: tp('confirmedTitle'),
          sub: tp('confirmedSub'),
        }
      : {
          icon: '•',
          warn: false,
          title: tc(`Statuses.${booking.status}`),
          sub: '',
        };

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
          background: heading.warn ? 'rgba(245,192,138,.16)' : 'var(--nv-lime)',
          border: heading.warn ? '1px solid var(--nv-warn)' : '0',
          color: heading.warn ? 'var(--nv-warn)' : 'var(--nv-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          fontWeight: 700,
        }}
      >
        {heading.icon}
      </div>
      <h1 style={{ fontSize: 'clamp(30px,4vw,44px)', lineHeight: 1.02 }}>
        {heading.title}
      </h1>
      {heading.sub && (
        <p
          style={{
            margin: 0,
            fontSize: 15,
            color: 'var(--nv-muted)',
            lineHeight: 1.55,
          }}
        >
          {heading.sub}
        </p>
      )}

      {/* Booking summary */}
      <div style={card}>
        <div style={row}>
          <span style={{ color: 'var(--nv-muted)' }}>{t('reference')}</span>
          <strong className="nv-mono">{booking.reference}</strong>
        </div>
        <div style={row}>
          <span style={{ color: 'var(--nv-muted)' }}>{t('service')}</span>
          <strong>
            {booking.serviceName} · {booking.tierLabel}
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

      {/* ===== PENDING: deposit ===== */}
      {isPending && (
        <>
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
          <PaymentPicker
            reference={booking.reference}
            locale={locale}
            kind="deposit"
          />
        </>
      )}

      {/* ===== CONFIRMED: balance due (info only — paying it lives in the B5
           booking view; no picker here) ===== */}
      {balanceDue && (
        <div style={card}>
          <div style={{ ...row, fontWeight: 600 }}>
            <span>{tp('balanceTitle')}</span>
            <span className="nv-mono">{money(booking.balanceCents)}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
            {tp('balanceSub')}
          </div>
        </div>
      )}

      {/* ===== CONFIRMED: fully paid ===== */}
      {fullyPaid && (
        <div style={card}>
          <strong>{tp('fullyPaidTitle')}</strong>
          <div style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
            {tp('fullyPaidSub')}
          </div>
        </div>
      )}
    </main>
  );
}
