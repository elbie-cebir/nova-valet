import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { getBookingByReference } from '@/lib/data/booking';
import {
  getPaymentsForBooking,
  getBookingEvents,
  countBookings,
} from '@/lib/data/admin';
import { getAvailableSlots } from '@/lib/data/availability';
import { AdminShell } from '@/components/admin/admin-shell';
import { BookingActions } from '@/components/admin/booking-actions';
import { WaComposer, type WaTemplate } from '@/components/admin/wa-composer';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/format';
import { LOCALES } from '@/i18n/routing';
import { BUSINESS_TIMEZONE } from '@/config/constants';

const card = {
  borderRadius: 16,
  padding: 16,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border-strong)',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 9,
  fontSize: 14,
};
const rowSB = { display: 'flex', justifyContent: 'space-between', gap: 10 };

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ locale: string; reference: string }>;
}) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  const owner = await requireOwner();

  const db = await getDb();
  const booking = await getBookingByReference(db, reference);
  if (!booking) notFound();

  const [payments, events, bookingCount] = await Promise.all([
    getPaymentsForBooking(db, booking.id),
    getBookingEvents(db, booking.id),
    countBookings(db, 'all'),
  ]);

  const now = new Date();
  const openSlots = (
    await getAvailableSlots(db, {
      from: now.toISOString(),
      to: new Date(now.getTime() + 45 * 24 * 3_600_000).toISOString(),
    })
  ).filter((s) => s.id !== booking.slotId);

  const t = await getTranslations('Admin');
  const tc = await getTranslations();
  const money = (c: number) => formatMoney(c, 'EUR', locale);

  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
  const dateFmt = new Intl.DateTimeFormat(bcp47, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  });
  const slotHeadingFmt = new Intl.DateTimeFormat(bcp47, {
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
  const slotHeading = `${slotHeadingFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;

  const rangeLabel = (a: string, b: string) =>
    `${dateFmt.format(new Date(a))}–${timeFmt.format(new Date(b))}`;
  const openSlotOptions = openSlots.map((s) => ({
    id: s.id,
    label: rangeLabel(s.startAt, s.endAt),
  }));

  const isActive =
    booking.status === 'confirmed' || booking.status === 'pending_deposit';
  const balanceOutstanding =
    booking.balancePaidAt === null && booking.balanceCents > 0;

  const statusPill = (() => {
    if (booking.status === 'confirmed')
      return { bg: 'rgba(214,240,77,.15)', fg: 'var(--nv-lime)' };
    if (booking.status === 'pending_deposit')
      return { bg: 'rgba(245,192,138,.14)', fg: 'var(--nv-warn)' };
    return { bg: 'rgba(255,138,126,.14)', fg: 'var(--nv-err)' };
  })();

  // ── WhatsApp templates, localized to the CUSTOMER's booking locale ──
  const bookingBcp =
    LOCALES[booking.locale as keyof typeof LOCALES] ?? booking.locale;
  const waWhen = new Intl.DateTimeFormat(bookingBcp, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  }).format(start);
  const bookingWa = await getTranslations({
    locale: booking.locale,
    namespace: 'Wa',
  });
  const bookingTc = await getTranslations({ locale: booking.locale });
  const uiWa = await getTranslations('Wa');
  const vars = {
    name: booking.customerName,
    ref: booking.reference,
    slot: waWhen,
    addr: `${booking.address}, ${booking.postcode}`,
    bal: formatMoney(booking.balanceCents, 'EUR', booking.locale),
    service: `${bookingTc(booking.serviceNameKey)} · ${bookingTc(booking.tierLabelKey)}`,
    time: timeFmt.format(start),
  };
  const templates: WaTemplate[] = [
    {
      key: 'confirm',
      label: uiWa('tConfirmLabel'),
      body: bookingWa('tConfirm', vars),
    },
    {
      key: 'reminder',
      label: uiWa('tReminderLabel'),
      body: bookingWa('tReminder', vars),
    },
    {
      key: 'balance',
      label: uiWa('tBalanceLabel'),
      body: bookingWa('tBalance', vars),
    },
    {
      key: 'onway',
      label: uiWa('tOnWayLabel'),
      body: bookingWa('tOnWay', vars),
    },
  ];

  return (
    <AdminShell
      locale={locale}
      ownerEmail={owner.email}
      active="bookings"
      bookingCount={bookingCount}
    >
      <div
        style={{
          padding: '18px 24px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          maxWidth: 1040,
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div style={{ ...rowSB, alignItems: 'center' }}>
          <Link
            href="/admin"
            style={{ color: 'var(--nv-muted)', fontSize: 14 }}
          >
            ‹ {t('back')}
          </Link>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'var(--nv-faint)',
            }}
          >
            {t('owner')} · {booking.reference}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,460px),1fr))',
            gap: 16,
            alignItems: 'start',
          }}
        >
          {/* ── left: identity + WhatsApp ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minWidth: 0,
            }}
          >
            <div style={{ ...rowSB, alignItems: 'center' }}>
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
                  background: statusPill.bg,
                  color: statusPill.fg,
                }}
              >
                {tc(`Statuses.${booking.status}`)}
              </span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(24px,3vw,36px)',
                lineHeight: 1.05,
                letterSpacing: '-.03em',
                margin: 0,
              }}
            >
              {slotHeading}
            </h1>
            <div style={{ fontSize: 15, lineHeight: 1.5 }}>
              <strong>{booking.customerName}</strong>
              <br />
              <span style={{ color: 'var(--nv-muted)' }}>
                {booking.customerPhone} · {booking.customerEmail} ·{' '}
                {t('locale')}{' '}
                <strong style={{ color: 'var(--nv-ink)' }}>
                  {booking.locale.toUpperCase()}
                </strong>
              </span>
            </div>

            <WaComposer
              phone={booking.customerPhone}
              langLabel={booking.locale.toUpperCase()}
              templates={templates}
            />
          </div>

          {/* ── right: summary + actions ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
              <div style={rowSB}>
                <span style={{ color: 'var(--nv-muted)' }}>{t('service')}</span>
                <strong style={{ textAlign: 'right' }}>
                  {tc(booking.serviceNameKey)} · {tc(booking.tierLabelKey)}
                </strong>
              </div>
              {booking.addOns.length > 0 && (
                <div style={rowSB}>
                  <span style={{ color: 'var(--nv-muted)' }}>
                    {t('addons')}
                  </span>
                  <strong style={{ textAlign: 'right' }}>
                    {booking.addOns.map((a) => tc(a.nameKey)).join(', ')}
                  </strong>
                </div>
              )}
              <div style={rowSB}>
                <span style={{ color: 'var(--nv-muted)' }}>{t('where')}</span>
                <strong style={{ textAlign: 'right' }}>
                  {booking.address}, {booking.postcode}
                </strong>
              </div>
              <div
                style={{
                  ...rowSB,
                  borderTop: '1px solid var(--nv-border)',
                  paddingTop: 12,
                }}
              >
                <span style={{ color: 'var(--nv-muted)' }}>{t('total')}</span>
                <span className="nv-mono">{money(booking.totalCents)}</span>
              </div>
              <div style={rowSB}>
                <span style={{ color: 'var(--nv-muted)' }}>{t('deposit')}</span>
                <span
                  style={{
                    color: booking.depositPaidAt
                      ? 'var(--nv-lime)'
                      : 'var(--nv-muted)',
                    fontWeight: 600,
                  }}
                >
                  {booking.depositPaidAt
                    ? `${t('paidOn')} ${dateFmt.format(new Date(booking.depositPaidAt))}`
                    : money(booking.depositCents)}
                </span>
              </div>
              <div style={rowSB}>
                <span style={{ color: 'var(--nv-muted)' }}>
                  {t('balance')}{' '}
                  <span className="nv-mono">{money(booking.balanceCents)}</span>
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: balanceOutstanding ? '#a9b8ff' : 'var(--nv-lime)',
                  }}
                >
                  {balanceOutstanding
                    ? t('paymentStatus.balance_outstanding')
                    : t('paymentStatus.fully_paid')}
                </span>
              </div>
            </div>

            {isActive && (
              <BookingActions
                reference={booking.reference}
                status={booking.status}
                balanceOutstanding={balanceOutstanding}
                openSlots={openSlotOptions}
              />
            )}

            {/* payment rows (money truth mirror, incl. refund_due) */}
            <div style={{ ...card, gap: 8 }}>
              <strong style={{ fontFamily: 'var(--font-display)' }}>
                {t('payments')}
              </strong>
              {payments.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
                  —
                </span>
              ) : (
                payments.map((p, i) => (
                  <div key={i} style={{ ...rowSB, alignItems: 'center' }}>
                    <span style={{ color: 'var(--nv-muted)' }}>
                      {p.kind} · {p.provider}/{p.method}
                    </span>
                    <span
                      style={{ display: 'flex', gap: 10, alignItems: 'center' }}
                    >
                      <span className="nv-mono">{money(p.amountCents)}</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color:
                            p.status === 'refund_due'
                              ? 'var(--nv-err)'
                              : p.status === 'paid'
                                ? 'var(--nv-lime)'
                                : 'var(--nv-muted)',
                        }}
                      >
                        {p.status}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* audit history */}
            <div style={{ ...card, gap: 8 }}>
              <strong style={{ fontFamily: 'var(--font-display)' }}>
                {t('history')}
              </strong>
              {events.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
                  {t('historyEmpty')}
                </span>
              ) : (
                events.map((e, i) => (
                  <div key={i} style={rowSB}>
                    <span style={{ color: 'var(--nv-muted)' }}>{e.type}</span>
                    <span style={{ fontSize: 13, textAlign: 'right' }}>
                      {e.actor}
                      <br />
                      <span style={{ color: 'var(--nv-faint)' }}>
                        {dateFmt.format(new Date(e.createdAt))}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
