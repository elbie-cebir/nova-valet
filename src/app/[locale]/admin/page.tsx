import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { listBookings, countBookings } from '@/lib/data/admin';
import { AdminShell } from '@/components/admin/admin-shell';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/format';
import { LOCALES } from '@/i18n/routing';
import { ADMIN_PAGE_SIZE, BUSINESS_TIMEZONE } from '@/config/constants';

const pageSchema = z.coerce.number().int().min(1).catch(1);

const paymentPill: Record<string, { bg: string; fg: string }> = {
  awaiting_deposit: { bg: 'rgba(245,192,138,.14)', fg: 'var(--nv-warn)' },
  balance_outstanding: { bg: 'rgba(90,120,255,.16)', fg: '#a9b8ff' },
  fully_paid: { bg: 'rgba(214,240,77,.15)', fg: 'var(--nv-lime)' },
};

export default async function AdminBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const owner = await requireOwner();

  const { page: pageRaw } = await searchParams;
  const page = pageSchema.parse(pageRaw);
  const offset = (page - 1) * ADMIN_PAGE_SIZE;

  const db = await getDb();
  const [rows, total] = await Promise.all([
    listBookings(db, { limit: ADMIN_PAGE_SIZE, offset }),
    countBookings(db),
  ]);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const t = await getTranslations('Admin');
  const tc = await getTranslations();
  const money = (c: number) => formatMoney(c, 'EUR', locale);
  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
  const whenFmt = new Intl.DateTimeFormat(bcp47, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BUSINESS_TIMEZONE,
  });

  return (
    <AdminShell locale={locale} ownerEmail={owner.email}>
      <h1 style={{ fontSize: 'clamp(24px,3vw,32px)', marginBottom: 16 }}>
        {t('bookings.title')}
      </h1>

      {rows.length === 0 ? (
        <p style={{ color: 'var(--nv-muted)' }}>{t('bookings.empty')}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div
            style={{
              minWidth: 720,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1.4fr 1.2fr 1fr 1fr 90px',
                gap: 12,
                padding: '0 14px',
                fontSize: 12,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'var(--nv-faint)',
                fontWeight: 600,
              }}
            >
              <span>{t('bookings.when')}</span>
              <span>{t('bookings.customer')}</span>
              <span>{t('bookings.service')}</span>
              <span>{t('bookings.status')}</span>
              <span>{t('bookings.payment')}</span>
              <span />
            </div>

            {rows.map((b) => {
              const pp = paymentPill[b.paymentStatus];
              return (
                <div
                  key={b.reference}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1.4fr 1.2fr 1fr 1fr 90px',
                    gap: 12,
                    alignItems: 'center',
                    padding: '14px',
                    borderRadius: 14,
                    background: 'var(--nv-surface)',
                    border: '1px solid var(--nv-border)',
                    fontSize: 14,
                  }}
                >
                  <span style={{ fontSize: 13 }}>
                    {whenFmt.format(new Date(b.slotStartAt))}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600 }}>
                      {b.customerName}
                    </span>
                    <span
                      className="nv-mono"
                      style={{ fontSize: 12, color: 'var(--nv-faint)' }}
                    >
                      {b.reference}
                    </span>
                  </span>
                  <span style={{ color: 'var(--nv-muted)' }}>
                    {tc(b.serviceNameKey)} · {tc(b.tierLabelKey)}
                  </span>
                  <span style={{ color: 'var(--nv-muted)' }}>
                    {tc(`Statuses.${b.status}`)}
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
                  <Link
                    href={`/admin/bookings/${b.reference}`}
                    style={{
                      color: 'var(--nv-lime)',
                      fontWeight: 600,
                      textAlign: 'right',
                    }}
                  >
                    {t('bookings.view')}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 20,
          fontSize: 14,
          color: 'var(--nv-muted)',
        }}
      >
        <PagerLink
          disabled={page <= 1}
          href={`/admin?page=${page - 1}`}
          label={t('bookings.prev')}
        />
        <span>{t('bookings.page', { page, pages })}</span>
        <PagerLink
          disabled={page >= pages}
          href={`/admin?page=${page + 1}`}
          label={t('bookings.next')}
        />
      </div>
    </AdminShell>
  );
}

function PagerLink({
  disabled,
  href,
  label,
}: {
  disabled: boolean;
  href: string;
  label: string;
}) {
  if (disabled) {
    return <span style={{ color: 'var(--nv-faint)' }}>{label}</span>;
  }
  return (
    <Link href={href} style={{ color: 'var(--nv-lime)', fontWeight: 600 }}>
      {label}
    </Link>
  );
}
