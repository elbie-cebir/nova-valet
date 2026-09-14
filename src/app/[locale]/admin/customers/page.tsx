import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { CSSProperties } from 'react';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { countBookings } from '@/lib/data/admin';
import { listCustomers, countCustomers } from '@/lib/data/reporting';
import { AdminShell } from '@/components/admin/admin-shell';
import { Pager } from '@/components/admin/pager';
import { ADMIN_PAGE_SIZE, BUSINESS_TIMEZONE } from '@/config/constants';
import { LOCALES } from '@/i18n/routing';

const pageSchema = z.coerce.number().int().min(1).max(9999).catch(1);

const th: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 11,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--nv-muted)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};
const td: CSSProperties = {
  padding: '12px',
  fontSize: 14,
  borderTop: '1px solid var(--nv-border)',
};

export default async function AdminCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const owner = await requireOwner();

  const { p } = await searchParams;
  const pageNum = pageSchema.parse(p);
  const offset = (pageNum - 1) * ADMIN_PAGE_SIZE;

  const db = await getDb();
  const [customers, total, bookingCount, t] = await Promise.all([
    listCustomers(db, { limit: ADMIN_PAGE_SIZE, offset }),
    countCustomers(db),
    countBookings(db, 'all'),
    getTranslations('Admin'),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
  const dateFmt = new Intl.DateTimeFormat(bcp47, {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <AdminShell
      locale={locale}
      ownerEmail={owner.email}
      active="customers"
      bookingCount={bookingCount}
    >
      <div
        style={{
          padding: '18px 20px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 12,
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
              {t('custTitle')}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--nv-muted)', marginTop: 6 }}>
              {t('custSub')} · {total} {t('custCount')}
            </p>
          </div>
          {total > 0 && (
            <a
              href="/api/admin/customers/export"
              style={{
                height: 40,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 18px',
                borderRadius: 999,
                background: 'var(--nv-lime)',
                color: 'var(--nv-bg)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {t('custExport')}
            </a>
          )}
        </div>

        {customers.length === 0 ? (
          <div style={{ color: 'var(--nv-muted)', fontSize: 14 }}>
            {t('custEmpty')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 640,
              }}
            >
              <thead>
                <tr>
                  <th style={th}>{t('custName')}</th>
                  <th style={th}>{t('custMobile')}</th>
                  <th style={th}>{t('custEmail')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>
                    {t('custBookings')}
                  </th>
                  <th style={th}>{t('custLast')}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.email}>
                    <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                    <td
                      style={{
                        ...td,
                        fontFamily: 'var(--font-mono)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.phone}
                    </td>
                    <td style={{ ...td, color: 'var(--nv-muted)' }}>
                      {c.email}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>{c.bookings}</td>
                    <td
                      style={{
                        ...td,
                        color: 'var(--nv-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {dateFmt.format(new Date(c.lastBookingAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pager
          basePath="/admin/customers"
          page={pageNum}
          totalPages={totalPages}
        />
      </div>
    </AdminShell>
  );
}
