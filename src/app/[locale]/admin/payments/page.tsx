import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import type { CSSProperties } from 'react';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { countBookings } from '@/lib/data/admin';
import {
  listPayments,
  countPayments,
  getPaymentSummary,
} from '@/lib/data/reporting';
import { AdminShell } from '@/components/admin/admin-shell';
import { Link } from '@/i18n/navigation';
import { formatMoney } from '@/lib/format';
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
  whiteSpace: 'nowrap',
};

function statusColor(s: string): string {
  if (s === 'paid') return 'var(--nv-lime)';
  if (s === 'refund_due') return 'var(--nv-warn)';
  if (s === 'failed') return 'var(--nv-err)';
  return 'var(--nv-muted)';
}

export default async function AdminPaymentsPage({
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
  const [rows, total, summary, bookingCount, t] = await Promise.all([
    listPayments(db, { limit: ADMIN_PAGE_SIZE, offset }),
    countPayments(db),
    getPaymentSummary(db),
    countBookings(db, 'all'),
    getTranslations('Admin'),
  ]);

  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
  const dateFmt = new Intl.DateTimeFormat(bcp47, {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  const card: CSSProperties = {
    flex: 1,
    minWidth: 150,
    borderRadius: 16,
    padding: 16,
    background: 'var(--nv-surface)',
    border: '1px solid var(--nv-border)',
  };

  return (
    <AdminShell
      locale={locale}
      ownerEmail={owner.email}
      active="payments"
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
            {t('payTitle')}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--nv-muted)', marginTop: 6 }}>
            {t('paySub')}
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={card}>
            <div style={th}>{t('payCollected')}</div>
            <div
              className="nv-mono"
              style={{ fontSize: 24, color: 'var(--nv-lime)' }}
            >
              {formatMoney(summary.collectedCents, 'EUR', locale)}
            </div>
          </div>
          <div style={card}>
            <div style={th}>{t('payPaidCount')}</div>
            <div style={{ fontSize: 24, fontFamily: 'var(--font-display)' }}>
              {summary.paidCount}
            </div>
          </div>
          <div style={card}>
            <div style={th}>{t('payRefunds')}</div>
            <div
              style={{
                fontSize: 24,
                fontFamily: 'var(--font-display)',
                color: summary.refundDueCount ? 'var(--nv-warn)' : undefined,
              }}
            >
              {summary.refundDueCount}
            </div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div style={{ color: 'var(--nv-muted)', fontSize: 14 }}>
            {t('payEmpty')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: 720,
              }}
            >
              <thead>
                <tr>
                  <th style={th}>{t('payDate')}</th>
                  <th style={th}>{t('payRef')}</th>
                  <th style={th}>{t('payCustomer')}</th>
                  <th style={th}>{t('payKind')}</th>
                  <th style={th}>{t('payProvider')}</th>
                  <th style={th}>{t('payMethod')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>
                    {t('payAmount')}
                  </th>
                  <th style={th}>{t('payStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.reference}-${i}`}>
                    <td style={{ ...td, color: 'var(--nv-muted)' }}>
                      {dateFmt.format(new Date(r.createdAt))}
                    </td>
                    <td style={{ ...td, fontFamily: 'var(--font-mono)' }}>
                      {r.reference}
                    </td>
                    <td style={td}>{r.customerName}</td>
                    <td style={{ ...td, color: 'var(--nv-muted)' }}>
                      {r.kind}
                    </td>
                    <td style={{ ...td, color: 'var(--nv-muted)' }}>
                      {r.provider}
                    </td>
                    <td style={{ ...td, color: 'var(--nv-muted)' }}>
                      {r.method}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {formatMoney(r.amountCents, 'EUR', locale)}
                    </td>
                    <td
                      style={{
                        ...td,
                        color: statusColor(r.status),
                        fontWeight: 600,
                      }}
                    >
                      {r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              color: 'var(--nv-muted)',
            }}
          >
            {pageNum > 1 ? (
              <Link
                href={`/admin/payments?p=${pageNum - 1}`}
                style={{ color: 'var(--nv-ink)' }}
              >
                ‹
              </Link>
            ) : (
              <span />
            )}
            <span>
              {pageNum} / {totalPages}
            </span>
            {pageNum < totalPages ? (
              <Link
                href={`/admin/payments?p=${pageNum + 1}`}
                style={{ color: 'var(--nv-ink)' }}
              >
                ›
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
