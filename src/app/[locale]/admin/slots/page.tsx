import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { CSSProperties } from 'react';
import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { listSlots } from '@/lib/data/slots';
import { countBookings } from '@/lib/data/admin';
import { AdminShell } from '@/components/admin/admin-shell';
import {
  SlotWeekManager,
  type WeekDay,
  type WeekCell,
} from '@/components/admin/slot-week-manager';
import { Link } from '@/i18n/navigation';
import { businessWallClockToUtcIso } from '@/lib/time';
import { LOCALES } from '@/i18n/routing';
import { BUSINESS_TIMEZONE } from '@/config/constants';

const weekSchema = z.coerce.number().int().min(-52).max(52).catch(0);

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function AdminSlotsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ w?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const owner = await requireOwner();

  const { w: wRaw } = await searchParams;
  const w = weekSchema.parse(wRaw);

  const bcp47 = LOCALES[locale as keyof typeof LOCALES] ?? locale;
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const timeFmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const dayLabelFmt = new Intl.DateTimeFormat(bcp47, {
    weekday: 'short',
    day: 'numeric',
    timeZone: BUSINESS_TIMEZONE,
  });
  const rangeLabelFmt = new Intl.DateTimeFormat(bcp47, {
    day: 'numeric',
    month: 'short',
    timeZone: BUSINESS_TIMEZONE,
  });

  // Monday of the current Brussels week, shifted by w weeks.
  const now = new Date();
  const todayStr = dateFmt.format(now);
  const todayWeekday = new Date(`${todayStr}T12:00:00Z`).getUTCDay(); // 0=Sun
  const mondayOffset = todayWeekday === 0 ? -6 : 1 - todayWeekday;
  const mondayStr = addDays(todayStr, mondayOffset + w * 7);
  const dayStrs = Array.from({ length: 7 }, (_, i) => addDays(mondayStr, i));

  const days: WeekDay[] = dayStrs.map((date) => {
    const noon = new Date(`${date}T12:00:00Z`);
    return {
      date,
      label: dayLabelFmt.format(noon),
      weekday: noon.getUTCDay(),
    };
  });

  const fromUtc =
    businessWallClockToUtcIso(`${mondayStr}T00:00`) ?? now.toISOString();
  const toUtc =
    businessWallClockToUtcIso(`${addDays(mondayStr, 7)}T00:00`) ??
    new Date(now.getTime() + 7 * 864e5).toISOString();

  const db = await getDb();
  const slots = await listSlots(db, { from: fromUtc, to: toUtc });

  const cells: Record<string, WeekCell> = {};
  const timeSet = new Set<string>();
  for (const s of slots) {
    const start = new Date(s.startAt);
    const date = dateFmt.format(start);
    const time = timeFmt.format(start);
    timeSet.add(time);
    const state: WeekCell['state'] = s.closed
      ? 'closed'
      : (s.status as 'open' | 'held' | 'booked');
    cells[`${date}|${time}`] = {
      id: s.id,
      state,
      ref: s.bookingReference,
    };
  }
  const times = Array.from(timeSet).sort();

  const [t, bookingCount] = await Promise.all([
    getTranslations('Admin'),
    countBookings(db, 'all'),
  ]);

  const weekRangeLabel = `${rangeLabelFmt.format(
    new Date(`${mondayStr}T12:00:00Z`),
  )} – ${rangeLabelFmt.format(new Date(`${addDays(mondayStr, 6)}T12:00:00Z`))}`;

  return (
    <AdminShell
      locale={locale}
      ownerEmail={owner.email}
      active="slots"
      bookingCount={bookingCount}
    >
      <div
        style={{
          padding: '18px 20px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
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
              {t('slotsTitle')}
            </h1>
            <div
              style={{ fontSize: 14, color: 'var(--nv-muted)', marginTop: 6 }}
            >
              {t('slotsSub')}{' '}
              <strong style={{ color: 'var(--nv-lime)' }}>{t('open')}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link href={`/admin/slots?w=${w - 1}`} style={navArrow}>
              ‹
            </Link>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 15,
                padding: '0 6px',
              }}
            >
              {weekRangeLabel}
            </span>
            <Link href={`/admin/slots?w=${w + 1}`} style={navArrow}>
              ›
            </Link>
          </div>
        </div>

        <SlotWeekManager
          days={days}
          times={times}
          cells={cells}
          rangeFrom={mondayStr}
          rangeTo={addDays(mondayStr, 13)}
        />
      </div>
    </AdminShell>
  );
}

const navArrow: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 999,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border-strong)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 18,
};
