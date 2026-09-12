import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import {
  listBookings,
  countBookings,
  getAdminStats,
  type BookingFilter,
} from '@/lib/data/admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { Link } from '@/i18n/navigation';
import { buildWaLink } from '@/lib/whatsapp';
import { formatMoney } from '@/lib/format';
import { LOCALES } from '@/i18n/routing';
import { ADMIN_PAGE_SIZE, BUSINESS_TIMEZONE } from '@/config/constants';

const pageSchema = z.coerce.number().int().min(1).catch(1);
const filterSchema = z
  .enum(['upcoming', 'balance', 'completed', 'cancelled', 'all'])
  .catch('upcoming');

const paymentPill: Record<string, { bg: string; fg: string }> = {
  awaiting_deposit: { bg: 'rgba(245,192,138,.14)', fg: 'var(--nv-warn)' },
  balance_outstanding: { bg: 'rgba(90,120,255,.16)', fg: '#a9b8ff' },
  fully_paid: { bg: 'rgba(214,240,77,.15)', fg: 'var(--nv-lime)' },
};

const COLS = '120px 1.3fr 1.3fr 90px 150px 52px';

export default async function AdminBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const owner = await requireOwner();

  const sp = await searchParams;
  const page = pageSchema.parse(sp.page);
  const filter = filterSchema.parse(sp.filter) as BookingFilter;
  const offset = (page - 1) * ADMIN_PAGE_SIZE;

  const now = new Date();
  const weekTo = new Date(now.getTime() + 7 * 24 * 3_600_000);

  const db = await getDb();
  const [rows, total, totalAll, stats] = await Promise.all([
    listBookings(db, { limit: ADMIN_PAGE_SIZE, offset, filter }),
    countBookings(db, filter),
    countBookings(db, 'all'),
    getAdminStats(db, { from: now.toISOString(), to: weekTo.toISOString() }),
  ]);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const t = await getTranslations('Admin');
  const tc = await getTranslations();
  const money = (c: number) => formatMoney(c, 'EUR', locale);
  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
  const dayFmt = new Intl.DateTimeFormat(bcp47, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: BUSINESS_TIMEZONE,
  });
  const timeFmt = new Intl.DateTimeFormat(bcp47, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  });
  const weekLabel = `${dayFmt.format(now)} – ${dayFmt.format(weekTo)}`;

  const filters: { key: BookingFilter; label: string }[] = [
    { key: 'upcoming', label: t('upcoming') },
    { key: 'balance', label: t('fBalance') },
    { key: 'completed', label: t('fCompleted') },
    { key: 'cancelled', label: t('fCancelled') },
    { key: 'all', label: t('fAll') },
  ];

  const statCard = (label: string, value: string) => (
    <div
      style={{
        borderRadius: 16,
        padding: '16px 18px',
        background: 'var(--nv-surface)',
        border: '1px solid var(--nv-border)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--nv-muted)' }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: '-.02em',
        }}
      >
        {value}
      </div>
    </div>
  );

  return (
    <AdminShell
      locale={locale}
      ownerEmail={owner.email}
      active="bookings"
      bookingCount={totalAll}
    >
      <div
        style={{
          padding: '24px 20px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px,3.2vw,40px)',
              letterSpacing: '-.03em',
              margin: 0,
              lineHeight: 1,
            }}
          >
            {t('bookings')}
          </h1>
          <div style={{ fontSize: 14, color: 'var(--nv-muted)', marginTop: 6 }}>
            {t('weekOf')} {weekLabel} · {stats.upcoming} {t('upcoming')}
          </div>
        </div>

        {/* stat cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,170px),1fr))',
            gap: 12,
          }}
        >
          {statCard(t('upcoming'), String(stats.upcoming))}
          {statCard(
            t('balancesOut'),
            `${stats.balancesOutstanding} · ${money(stats.balancesOutstandingCents)}`,
          )}
          {statCard(t('openSlotsWeek'), String(stats.openSlotsThisWeek))}
          {statCard(t('remindersDue'), '0')}
        </div>

        {/* filter chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {filters.map((f) => {
            const isActive = f.key === filter;
            return (
              <Link
                key={f.key}
                href={`/admin?filter=${f.key}`}
                style={{
                  padding: '8px 14px',
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 600,
                  background: isActive ? 'var(--nv-ink)' : 'var(--nv-surface)',
                  color: isActive ? 'var(--nv-bg)' : 'var(--nv-muted)',
                  border: '1px solid var(--nv-border)',
                }}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        {/* table */}
        {rows.length === 0 ? (
          <p style={{ color: 'var(--nv-muted)' }}>{t('empty')}</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div
              style={{
                minWidth: 760,
                borderRadius: 20,
                background: 'var(--nv-surface)',
                border: '1px solid var(--nv-border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: COLS,
                  gap: 16,
                  padding: '12px 20px',
                  fontSize: 11,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--nv-faint)',
                  fontWeight: 600,
                  borderBottom: '1px solid var(--nv-border)',
                }}
              >
                <span>{t('colSlot')}</span>
                <span>{t('colCustomer')}</span>
                <span>{t('colService')}</span>
                <span>{t('colLocation')}</span>
                <span>{t('colPayment')}</span>
                <span />
              </div>
              {rows.map((b) => {
                const pp = paymentPill[b.paymentStatus];
                const start = new Date(b.slotStartAt);
                const wa = buildWaLink({
                  toPhone: b.customerPhone,
                  body: b.reference,
                });
                return (
                  <div
                    key={b.reference}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: COLS,
                      gap: 16,
                      alignItems: 'center',
                      padding: '14px 20px',
                      borderTop: '1px solid var(--nv-border)',
                      fontSize: 14,
                    }}
                  >
                    <Link href={`/admin/bookings/${b.reference}`}>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          fontSize: 15,
                        }}
                      >
                        {dayFmt.format(start)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--nv-muted)' }}>
                        {timeFmt.format(start)}
                      </div>
                    </Link>
                    <Link href={`/admin/bookings/${b.reference}`}>
                      <div style={{ fontWeight: 600 }}>{b.customerName}</div>
                      <div
                        className="nv-mono"
                        style={{ fontSize: 12, color: 'var(--nv-faint)' }}
                      >
                        {b.reference}
                      </div>
                    </Link>
                    <span style={{ color: 'var(--nv-muted)' }}>
                      {tc(b.serviceNameKey)} · {tc(b.tierLabelKey)}
                    </span>
                    <span
                      className="nv-mono"
                      style={{ fontSize: 13, color: 'var(--nv-muted)' }}
                    >
                      {b.postcode}
                    </span>
                    <span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '5px 9px',
                          borderRadius: 999,
                          background: pp.bg,
                          color: pp.fg,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t(`paymentStatus.${b.paymentStatus}`)}
                      </span>
                    </span>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          width: 40,
                          height: 32,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          background: 'var(--nv-wa)',
                          color: '#04140b',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        WA
                      </a>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* pagination */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 14,
            color: 'var(--nv-muted)',
          }}
        >
          {page > 1 ? (
            <Link
              href={`/admin?filter=${filter}&page=${page - 1}`}
              style={{ color: 'var(--nv-lime)', fontWeight: 600 }}
            >
              {t('prev')}
            </Link>
          ) : (
            <span style={{ color: 'var(--nv-faint)' }}>{t('prev')}</span>
          )}
          <span>{t('page', { page, pages })}</span>
          {page < pages ? (
            <Link
              href={`/admin?filter=${filter}&page=${page + 1}`}
              style={{ color: 'var(--nv-lime)', fontWeight: 600 }}
            >
              {t('next')}
            </Link>
          ) : (
            <span style={{ color: 'var(--nv-faint)' }}>{t('next')}</span>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
