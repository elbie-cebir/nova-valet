'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  createSlotsAction,
  setSlotClosedAction,
} from '@/app/[locale]/admin/actions';

export interface WeekCell {
  id: string;
  state: 'open' | 'held' | 'booked' | 'closed';
  ref: string | null;
}
export interface WeekDay {
  date: string; // YYYY-MM-DD (Brussels)
  label: string; // "Mon 13"
  weekday: number; // JS getUTCDay 0..6
}

const cellStyle: Record<WeekCell['state'], CSSProperties> = {
  open: {
    border: '1.5px solid #6FCF97',
    background: 'transparent',
    color: '#6FCF97',
  },
  held: {
    border: 0,
    background: 'rgba(245,192,138,.3)',
    color: 'var(--nv-warn)',
  },
  booked: { border: 0, background: 'var(--nv-lime)', color: 'var(--nv-bg)' },
  closed: {
    border: 0,
    background: 'rgba(255,255,255,.06)',
    color: 'var(--nv-faint)',
  },
};

const DEFAULT_TIMES = ['08:00', '10:00', '13:00', '15:30', '19:00'];

export function SlotWeekManager({
  days,
  times,
  cells,
  rangeFrom,
  rangeTo,
}: {
  days: WeekDay[];
  times: string[];
  cells: Record<string, WeekCell>;
  rangeFrom: string;
  rangeTo: string;
}) {
  const t = useTranslations('Admin');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  // create-panel state
  const [pickedDays, setPickedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon–Fri
  const [pickedTimes, setPickedTimes] = useState<string[]>(['10:00', '13:00']);
  const [customTime, setCustomTime] = useState('');
  const [from, setFrom] = useState(rangeFrom);
  const [to, setTo] = useState(rangeTo);

  const dayLetters: { n: number; l: string }[] = [
    { n: 1, l: 'M' },
    { n: 2, l: 'T' },
    { n: 3, l: 'W' },
    { n: 4, l: 'T' },
    { n: 5, l: 'F' },
    { n: 6, l: 'S' },
    { n: 0, l: 'S' },
  ];
  const timeChips = Array.from(
    new Set([...DEFAULT_TIMES, ...pickedTimes]),
  ).sort();

  function toggleClosed(cell: WeekCell) {
    if (pending) return;
    if (cell.state !== 'open' && cell.state !== 'closed') return; // booked/held locked
    setNote(null);
    startTransition(async () => {
      const res = await setSlotClosedAction({
        slotId: cell.id,
        closed: cell.state === 'open',
      });
      if (res.ok) router.refresh();
    });
  }

  function create() {
    if (pending) return;
    if (pickedDays.length === 0 || pickedTimes.length === 0) {
      setNote(t('invalid'));
      return;
    }
    setNote(null);
    startTransition(async () => {
      const res = await createSlotsAction({
        weekdays: pickedDays,
        times: pickedTimes,
        from,
        to,
      });
      if (res.ok) {
        let msg = t('created', { n: res.created });
        if (res.skipped > 0)
          msg += ' ' + t('overlapSkipped', { n: res.skipped });
        setNote(msg);
        router.refresh();
      } else {
        setNote(t('invalid'));
      }
    });
  }

  const legendSwatch = (s: WeekCell['state'], label: string) => (
    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          ...cellStyle[s],
        }}
      />
      {label}
    </span>
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))',
        gap: 20,
        alignItems: 'start',
      }}
    >
      {/* ── week grid ── */}
      <div
        style={{
          gridColumn: '1/-1',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minWidth: 0,
        }}
      >
        <div style={{ overflowX: 'auto', margin: '0 -4px', padding: '0 4px' }}>
          <div
            style={{
              borderRadius: 20,
              background: 'var(--nv-surface)',
              border: '1px solid var(--nv-border)',
              overflow: 'hidden',
            }}
          >
            {/* day headers */}
            <div
              className="nv-slot-grid"
              style={{
                borderBottom: '1px solid var(--nv-border)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--nv-muted)',
                textAlign: 'center',
                gap: 6,
                padding: '10px 8px',
              }}
            >
              <div />
              {days.map((d) => (
                <div key={d.date}>{d.label}</div>
              ))}
            </div>
            {/* time rows */}
            {times.length === 0 ? (
              <div
                style={{ padding: 20, color: 'var(--nv-muted)', fontSize: 14 }}
              >
                {t('empty')}
              </div>
            ) : (
              times.map((time) => (
                <div
                  key={time}
                  className="nv-slot-grid"
                  style={{ padding: '6px 8px', gap: 6 }}
                >
                  <div
                    className="nv-mono"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--nv-muted)',
                      fontSize: 11,
                    }}
                  >
                    {time}
                  </div>
                  {days.map((d) => {
                    const cell = cells[`${d.date}|${time}`];
                    if (!cell) {
                      return (
                        <div
                          key={d.date}
                          style={{
                            height: 40,
                            borderRadius: 8,
                            border: '1px dashed var(--nv-border)',
                          }}
                        />
                      );
                    }
                    const locked =
                      cell.state === 'booked' || cell.state === 'held';
                    return (
                      <button
                        key={d.date}
                        onClick={() => toggleClosed(cell)}
                        disabled={pending || locked}
                        title={cell.ref ?? cell.state}
                        style={{
                          height: 40,
                          borderRadius: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: locked ? 'default' : 'pointer',
                          ...cellStyle[cell.state],
                        }}
                      >
                        {cell.ref ? (
                          <span
                            className="nv-mono"
                            style={{ fontSize: 9, fontWeight: 400 }}
                          >
                            {cell.ref.replace('NV-', '')}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
        <div
          style={{ fontSize: 13, color: 'var(--nv-muted)', lineHeight: 1.5 }}
        >
          {t('tapHint')}
        </div>
      </div>

      {/* ── create panel ── */}
      <div
        style={{
          borderRadius: 20,
          padding: 20,
          background: 'var(--nv-surface)',
          border: '1px solid var(--nv-border-strong)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 20,
            letterSpacing: '-.02em',
          }}
        >
          {t('createSlots')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--nv-muted)' }}
          >
            {t('days')}
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {dayLetters.map((d, i) => {
              const on = pickedDays.includes(d.n);
              return (
                <button
                  key={i}
                  onClick={() =>
                    setPickedDays((p) =>
                      p.includes(d.n)
                        ? p.filter((x) => x !== d.n)
                        : [...p, d.n],
                    )
                  }
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 8,
                    border: 0,
                    fontSize: 12,
                    fontWeight: 600,
                    background: on ? 'var(--nv-ink)' : 'var(--nv-surface-2)',
                    color: on ? 'var(--nv-bg)' : 'var(--nv-faint)',
                  }}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--nv-muted)' }}
          >
            {t('startTimes')}
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {timeChips.map((tm) => {
              const on = pickedTimes.includes(tm);
              return (
                <button
                  key={tm}
                  onClick={() =>
                    setPickedTimes((p) =>
                      p.includes(tm) ? p.filter((x) => x !== tm) : [...p, tm],
                    )
                  }
                  style={{
                    padding: '8px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    border: on ? 0 : '1px solid var(--nv-border-strong)',
                    background: on ? 'var(--nv-ink)' : 'transparent',
                    color: on ? 'var(--nv-bg)' : 'var(--nv-muted)',
                  }}
                >
                  {tm}
                </button>
              );
            })}
            <input
              type="time"
              step={1800}
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              onBlur={() => {
                if (/^\d{2}:\d{2}$/.test(customTime)) {
                  setPickedTimes((p) =>
                    p.includes(customTime) ? p : [...p, customTime],
                  );
                  setCustomTime('');
                }
              }}
              style={{
                height: 34,
                borderRadius: 999,
                background: 'var(--nv-surface-2)',
                border: '1px dashed var(--nv-border-strong)',
                color: 'var(--nv-ink)',
                padding: '0 10px',
                fontSize: 12,
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            style={{ fontSize: 12, fontWeight: 600, color: 'var(--nv-muted)' }}
          >
            {t('range')}
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={dateInput}
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={dateInput}
            />
          </div>
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            background: 'var(--nv-surface-2)',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--nv-muted)',
          }}
        >
          {t('createsN')}
        </div>

        <button
          onClick={create}
          disabled={pending}
          style={{
            height: 48,
            borderRadius: 999,
            border: 0,
            background: 'var(--nv-lime)',
            color: 'var(--nv-bg)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {t('createOpen')}
        </button>
        {note && (
          <div style={{ fontSize: 13, color: 'var(--nv-muted)' }}>{note}</div>
        )}
      </div>

      {/* ── legend ── */}
      <div
        style={{
          borderRadius: 20,
          padding: 20,
          background: 'var(--nv-surface)',
          border: '1px solid var(--nv-border)',
          fontSize: 13,
          color: 'var(--nv-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <strong style={{ color: 'var(--nv-ink)' }}>{t('legend')}</strong>
        {legendSwatch('open', t('open'))}
        {legendSwatch('held', t('heldCheckout'))}
        {legendSwatch('booked', t('booked'))}
        {legendSwatch('closed', t('closed'))}
      </div>
    </div>
  );
}

const dateInput: CSSProperties = {
  flex: 1,
  height: 40,
  borderRadius: 10,
  background: 'var(--nv-surface-2)',
  border: '1px solid var(--nv-border-strong)',
  color: 'var(--nv-ink)',
  padding: '0 12px',
  fontSize: 13,
};
