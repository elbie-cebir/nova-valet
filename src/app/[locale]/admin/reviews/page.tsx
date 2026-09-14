import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { countBookings } from '@/lib/data/admin';
import { listReviewsAdmin, countReviews } from '@/lib/data/reviews';
import { AdminShell } from '@/components/admin/admin-shell';
import { ReviewsEditor } from '@/components/admin/reviews-editor';
import { Pager } from '@/components/admin/pager';
import { ADMIN_PAGE_SIZE } from '@/config/constants';

const pageSchema = z.coerce.number().int().min(1).max(9999).catch(1);

export default async function AdminReviewsPage({
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
  const [reviews, total, bookingCount, t] = await Promise.all([
    listReviewsAdmin(db, { limit: ADMIN_PAGE_SIZE, offset }),
    countReviews(db),
    countBookings(db, 'all'),
    getTranslations('Admin'),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <AdminShell
      locale={locale}
      ownerEmail={owner.email}
      active="reviews"
      bookingCount={bookingCount}
    >
      <div
        style={{
          padding: '18px 20px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px,3.2vw,40px)',
            letterSpacing: '-.03em',
            margin: 0,
            lineHeight: 1,
          }}
        >
          {t('revTitle')}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--nv-muted)',
            margin: '4px 0 8px',
          }}
        >
          {t('revSub')}
        </p>
        <ReviewsEditor reviews={reviews} />
        <Pager
          basePath="/admin/reviews"
          page={pageNum}
          totalPages={totalPages}
        />
      </div>
    </AdminShell>
  );
}
