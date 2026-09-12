import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { getBookingByReference } from '@/lib/data/booking';
import { getPaymentsForBooking, getBookingEvents } from '@/lib/data/admin';
import { getAvailableSlots } from '@/lib/data/availability';
import { manualAdapter } from '@/lib/whatsapp';
import { AdminShell } from '@/components/admin/admin-shell';
import { BookingActions } from '@/components/admin/booking-actions';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/format';
import { LOCALES } from '@/i18n/routing';
import { BUSINESS_TIMEZONE } from '@/config/constants';

const card = {
  borderRadius: 18,
  padding: 20,
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

  const [payments, events] = await Promise.all([
    getPaymentsForBooking(db, booking.id),
    getBookingEvents(db, booking.id),
  ]);

  // Open slots the booking can be moved to (excluding its own).
  const now = new Date();
  const openSlots = (
    await getAvailableSlots(db, {
      from: now.toISOString(),
      to: new Date(now.getTime() + 45 * 24 * 3_600_000).toISOString(),
    })
  ).filter((s) => s.id !== booking.slotId);

  const t = await getTranslations('Admin.detail');
  const ta = await getTranslations('Admin');
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
  const rangeLabel = (startAt: string, endAt: string) => {
    const s = new Date(startAt);
    const e = new Date(endAt);
    const tf = new Intl.DateTimeFormat(bcp47, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: BUSINESS_TIMEZONE,
    });
    return `${dateFmt.format(s)}–${tf.format(e)}`;
  };

  // Owner-tap WhatsApp — message localized to the CUSTOMER's booking locale.
  const tcBooking = await getTranslations({ locale: booking.locale });
  const twa = await getTranslations({
    locale: booking.locale,
    namespace: 'Wa',
  });
  const bookingBcp =
    LOCALES[booking.locale as keyof typeof LOCALES] ?? booking.locale;
  const waWhen = new Intl.DateTimeFormat(bookingBcp, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  }).format(new Date(booking.slotStartAt));
  const waBody = twa('message', {
    name: booking.customerName,
    service: `${tcBooking(booking.serviceNameKey)} · ${tcBooking(booking.tierLabelKey)}`,
    when: waWhen,
    reference: booking.reference,
  });
  const waLink = manualAdapter.buildLink({
    toPhone: booking.customerPhone,
    body: waBody,
  });

  const openSlotOptions = openSlots.map((s) => ({
    id: s.id,
    label: rangeLabel(s.startAt, s.endAt),
  }));

  return (
    <AdminShell locale={locale} ownerEmail={owner.email}>
      <Link href="/admin" style={{ color: 'var(--nv-muted)', fontSize: 14 }}>
        ‹ {t('back')}
      </Link>

      <div className="nv-book-grid" style={{ marginTop: 14 }}>
        {/* left: details, payments, history */}
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
            <h1 style={{ fontSize: 'clamp(22px,3vw,30px)' }}>
              {t('title', { reference: booking.reference })}
            </h1>
            <span style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
              {tc(`Statuses.${booking.status}`)}
            </span>
          </div>

          <div style={card}>
            <div style={row}>
              <span style={{ color: 'var(--nv-muted)' }}>{t('customer')}</span>
              <strong>{booking.customerName}</strong>
            </div>
            <div style={row}>
              <span style={{ color: 'var(--nv-muted)' }}>{t('contact')}</span>
              <span style={{ textAlign: 'right' }}>
                {booking.customerPhone}
                <br />
                {booking.customerEmail}
              </span>
            </div>
            <div style={row}>
              <span style={{ color: 'var(--nv-muted)' }}>{t('service')}</span>
              <strong>
                {tc(booking.serviceNameKey)} · {tc(booking.tierLabelKey)}
              </strong>
            </div>
            <div style={row}>
              <span style={{ color: 'var(--nv-muted)' }}>{t('when')}</span>
              <strong style={{ textAlign: 'right' }}>
                {rangeLabel(booking.slotStartAt, booking.slotEndAt)}
              </strong>
            </div>
            <div style={row}>
              <span style={{ color: 'var(--nv-muted)' }}>{t('where')}</span>
              <strong style={{ textAlign: 'right' }}>
                {booking.address}, {booking.postcode}
              </strong>
            </div>
            <div
              style={{
                ...row,
                borderTop: '1px solid var(--nv-border)',
                paddingTop: 10,
              }}
            >
              <span style={{ color: 'var(--nv-muted)' }}>{t('deposit')}</span>
              <span className="nv-mono">{money(booking.depositCents)}</span>
            </div>
            <div style={row}>
              <span style={{ color: 'var(--nv-muted)' }}>{t('balance')}</span>
              <span className="nv-mono">{money(booking.balanceCents)}</span>
            </div>
            <div style={{ ...row, fontWeight: 600 }}>
              <span>{t('total')}</span>
              <span className="nv-mono">{money(booking.totalCents)}</span>
            </div>
          </div>

          {/* payments (money truth is the provider; this mirrors it) */}
          <div style={card}>
            <strong style={{ fontFamily: 'var(--font-display)' }}>
              {t('payments')}
            </strong>
            {payments.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
                {t('paymentsEmpty')}
              </span>
            ) : (
              payments.map((p, i) => (
                <div key={i} style={{ ...row, alignItems: 'center' }}>
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
          <div style={card}>
            <strong style={{ fontFamily: 'var(--font-display)' }}>
              {t('history')}
            </strong>
            {events.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
                {t('historyEmpty')}
              </span>
            ) : (
              events.map((e, i) => (
                <div key={i} style={{ ...row }}>
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

        {/* right: actions + WhatsApp */}
        <aside className="nv-book-aside">
          <div style={card}>
            <BookingActions
              reference={booking.reference}
              status={booking.status}
              openSlots={openSlotOptions}
            />
          </div>

          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                height: 50,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                borderRadius: 14,
                background: 'var(--nv-wa)',
                color: '#04140b',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              {ta('wa.button')}
            </a>
          )}
        </aside>
      </div>
    </AdminShell>
  );
}
