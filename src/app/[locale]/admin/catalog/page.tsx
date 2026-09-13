import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { countBookings } from '@/lib/data/admin';
import {
  getAdminServices,
  getAdminTiers,
  getAdminAddOns,
  getAdminPriceMatrix,
} from '@/lib/data/catalog-admin';
import { getDepositCents } from '@/lib/data/settings';
import { AdminShell } from '@/components/admin/admin-shell';
import { CatalogEditor } from '@/components/admin/catalog-editor';

export default async function AdminCatalogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const owner = await requireOwner();

  const db = await getDb();
  const [services, tiers, addOns, prices, depositCents, bookingCount, t] =
    await Promise.all([
      getAdminServices(db),
      getAdminTiers(db),
      getAdminAddOns(db),
      getAdminPriceMatrix(db),
      getDepositCents(db),
      countBookings(db, 'all'),
      getTranslations('Admin'),
    ]);

  return (
    <AdminShell
      locale={locale}
      ownerEmail={owner.email}
      active="catalog"
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
          {t('catTitle')}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'var(--nv-muted)',
            margin: '4px 0 8px',
          }}
        >
          {t('catSub')}
        </p>
        <CatalogEditor
          services={services}
          tiers={tiers}
          addOns={addOns}
          prices={prices}
          depositCents={depositCents}
        />
      </div>
    </AdminShell>
  );
}
