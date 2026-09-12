import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { getDb } from '@/lib/data/db.server';
import { resolveBookingByToken } from '@/lib/data/token';
import { formatMoney } from '@/lib/format';
import { LOCALES } from '@/i18n/routing';
import { BUSINESS_TIMEZONE } from '@/config/constants';
import { bookingUrl } from '@/lib/url';
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

export default async function GuestBookingPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const db = await getDb();
  const booking = await resolveBookingByToken(db, token);
  // Fail closed: unknown / used / expired token → not found (no leak).
  if (!booking) notFound();

  const t = await getTranslations('BookingView');
  const tp = await getTranslations('Checkout');
  const tb = await getTranslations('BookingPending');
  const tc = await getTranslations();

  const money = (c: number) => formatMoney(c, 'EUR', locale);
  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
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
  const start = new Date(booking.slotStartAt);
  const end = new Date(booking.slotEndAt);
  const whenText = `${dateFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;

  const isPending = booking.status === 'pending_deposit';
  const isConfirmed = booking.status === 'confirmed';
  const balanceDue =
    isConfirmed && booking.balancePaidAt === null && booking.balanceCents > 0;
  const fullyPaid =
    isConfirmed &&
    (booking.balancePaidAt !== null || booking.balanceCents === 0);
  const isDead = booking.status === 'cancelled' || booking.status === 'expired';

  const pill = isConfirmed
    ? { bg: 'rgba(214,240,77,.15)', fg: 'var(--nv-lime)' }
    : isPending
      ? { bg: 'rgba(245,192,138,.14)', fg: 'var(--nv-warn)' }
      : { bg: 'rgba(255,138,126,.14)', fg: 'var(--nv-err)' };

  // QR encodes this page's own token URL (QR-to-booking).
  const selfUrl = bookingUrl(locale, token);
  const qrSvg = await QRCode.toString(selfUrl, {
    type: 'svg',
    margin: 1,
    width: 132,
    color: { dark: '#0B0C0A', light: '#ffffff' },
  });

  return (
    <main
      style={{
        maxWidth: 900,
        width: '100%',
        margin: '0 auto',
        padding: '28px 20px 64px',
      }}
    >
      <div className="nv-book-grid">
        {/* ---- left: details ---- */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span
              className="nv-mono"
              style={{ fontSize: 14, color: 'var(--nv-muted)' }}
            >
              {booking.reference}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 10px',
                borderRadius: 999,
                background: pill.bg,
                color: pill.fg,
                whiteSpace: 'nowrap',
              }}
            >
              {tc(`Statuses.${booking.status}`)}
            </span>
          </div>
          <h1 style={{ fontSize: 'clamp(26px,3.4vw,38px)', lineHeight: 1.05 }}>
            {t('yourBooking')}
          </h1>

          <div style={card}>
            <div style={row}>
              <span style={{ color: 'var(--nv-muted)' }}>{tb('service')}</span>
              <strong>
                {tc(booking.serviceNameKey)} · {tc(booking.tierLabelKey)}
              </strong>
            </div>
            <div style={row}>
              <span style={{ color: 'var(--nv-muted)' }}>{tb('when')}</span>
              <strong style={{ textAlign: 'right' }}>{whenText}</strong>
            </div>
            <div style={row}>
              <span style={{ color: 'var(--nv-muted)' }}>{tb('where')}</span>
              <strong style={{ textAlign: 'right' }}>
                {booking.address}, {booking.postcode}
              </strong>
            </div>
            <div
              style={{
                ...row,
                borderTop: '1px solid var(--nv-border)',
                paddingTop: 10,
                fontWeight: 600,
              }}
            >
              <span>{tb('total')}</span>
              <span className="nv-mono">{money(booking.totalCents)}</span>
            </div>
          </div>
        </div>

        {/* ---- right: QR + payment/status ---- */}
        <aside className="nv-book-aside">
          {/* QR */}
          <div style={{ ...card, alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 148,
                height: 148,
                padding: 8,
                borderRadius: 14,
                background: '#fff',
                display: 'flex',
              }}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div
              style={{
                fontSize: 12,
                color: 'var(--nv-muted)',
                textAlign: 'center',
              }}
            >
              {t('scanHint')}
            </div>
          </div>

          {/* pending → deposit picker */}
          {isPending && (
            <>
              <div style={card}>
                <div style={{ ...row, fontWeight: 600 }}>
                  <span>{tb('depositNow')}</span>
                  <span className="nv-mono">{money(booking.depositCents)}</span>
                </div>
              </div>
              <PaymentPicker
                reference={booking.reference}
                locale={locale}
                kind="deposit"
                token={token}
              />
            </>
          )}

          {/* confirmed → deposit paid + balance */}
          {isConfirmed && (
            <div style={card}>
              <div style={{ ...row, color: 'var(--nv-muted)' }}>
                <span>{t('depositPaid')}</span>
                <span className="nv-mono" style={{ color: 'var(--nv-lime)' }}>
                  {money(booking.depositCents)}
                </span>
              </div>
              {balanceDue ? (
                <div style={{ ...row, fontWeight: 600 }}>
                  <span>{tp('balanceTitle')}</span>
                  <span className="nv-mono">{money(booking.balanceCents)}</span>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
                  {tp('fullyPaidSub')}
                </div>
              )}
            </div>
          )}
          {balanceDue && (
            <PaymentPicker
              reference={booking.reference}
              locale={locale}
              kind="balance"
              token={token}
            />
          )}
          {fullyPaid && (
            <div style={card}>
              <strong>{tp('fullyPaidTitle')}</strong>
            </div>
          )}

          {isDead && (
            <div style={card}>
              <strong>{tc(`Statuses.${booking.status}`)}</strong>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
