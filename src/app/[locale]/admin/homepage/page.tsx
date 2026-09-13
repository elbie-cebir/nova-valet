import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { countBookings } from '@/lib/data/admin';
import { getHomepageAdmin } from '@/lib/data/homepage';
import { AdminShell } from '@/components/admin/admin-shell';
import { HomepageEditor } from '@/components/admin/homepage-editor';

export default async function AdminHomepagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const owner = await requireOwner();

  const db = await getDb();
  const [content, bookingCount, t] = await Promise.all([
    getHomepageAdmin(db),
    countBookings(db, 'all'),
    getTranslations('Admin'),
  ]);

  return (
    <AdminShell
      locale={locale}
      ownerEmail={owner.email}
      active="homepage"
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
          {t('homeTitle')}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--nv-muted)',
            margin: '4px 0 8px',
          }}
        >
          {t('homeSub')}
        </p>
        {content && <HomepageEditor content={content} />}
      </div>
    </AdminShell>
  );
}
