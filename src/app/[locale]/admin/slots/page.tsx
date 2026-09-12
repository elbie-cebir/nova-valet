import { getTranslations, setRequestLocale } from 'next-intl/server';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { listSlots } from '@/lib/data/slots';
import { AdminShell } from '@/components/admin/admin-shell';
import {
  SlotManager,
  type AdminSlotView,
} from '@/components/admin/slot-manager';
import { LOCALES } from '@/i18n/routing';
import { BUSINESS_TIMEZONE } from '@/config/constants';

export default async function AdminSlotsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const owner = await requireOwner();

  const now = new Date();
  const to = new Date(now.getTime() + 45 * 24 * 3_600_000);

  const db = await getDb();
  const slots = await listSlots(db, {
    from: now.toISOString(),
    to: to.toISOString(),
  });

  const t = await getTranslations('Admin.slots');
  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
  const dateFmt = new Intl.DateTimeFormat(bcp47, {
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
  const label = (startAt: string, endAt: string) => {
    const s = new Date(startAt);
    const e = new Date(endAt);
    return `${dateFmt.format(s)} · ${timeFmt.format(s)}–${timeFmt.format(e)}`;
  };

  const views: AdminSlotView[] = slots.map((s) => ({
    id: s.id,
    label: label(s.startAt, s.endAt),
    status: s.status,
    closed: s.closed,
    bookingReference: s.bookingReference,
  }));

  return (
    <AdminShell locale={locale} ownerEmail={owner.email}>
      <h1 style={{ fontSize: 'clamp(24px,3vw,32px)', marginBottom: 6 }}>
        {t('title')}
      </h1>
      <p style={{ color: 'var(--nv-muted)', marginBottom: 20, fontSize: 15 }}>
        {t('sub')}
      </p>
      <SlotManager slots={views} />
    </AdminShell>
  );
}
