'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  createSlotAction,
  setSlotClosedAction,
} from '@/app/[locale]/admin/actions';

export interface AdminSlotView {
  id: string;
  label: string;
  status: string; // 'open' | 'held' | 'booked'
  closed: boolean;
  bookingReference: string | null;
}

const card = {
  borderRadius: 16,
  padding: 18,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border)',
};

export function SlotManager({ slots }: { slots: AdminSlotView[] }) {
  const t = useTranslations('Admin.slots');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function create() {
    if (pending || !value) return;
    setError(null);
    startTransition(async () => {
      const res = await createSlotAction({ localDateTime: value });
      if (res.ok) {
        setValue('');
        router.refresh();
      } else {
        setError(res.reason === 'overlap' ? t('overlap') : t('invalid'));
      }
    });
  }

  function toggle(id: string, closed: boolean) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const res = await setSlotClosedAction({ slotId: id, closed });
      if (res.ok) router.refresh();
    });
  }

  function tag(s: AdminSlotView): { label: string; fg: string } {
    if (s.closed) return { label: t('tag.closed'), fg: 'var(--nv-faint)' };
    if (s.status === 'booked') return { label: t('tag.booked'), fg: '#a9b8ff' };
    if (s.status === 'held')
      return { label: t('tag.held'), fg: 'var(--nv-warn)' };
    return { label: t('tag.open'), fg: 'var(--nv-lime)' };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* create */}
      <div
        style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <strong style={{ fontFamily: 'var(--font-display)' }}>
          {t('createTitle')}
        </strong>
        <label style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
          {t('start')}
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="datetime-local"
            value={value}
            step={3600}
            onChange={(e) => setValue(e.target.value)}
            style={{
              height: 48,
              borderRadius: 12,
              background: 'var(--nv-surface-2)',
              border: '1px solid var(--nv-border-strong)',
              color: 'var(--nv-ink)',
              padding: '0 14px',
              fontSize: 15,
              flex: 1,
              minWidth: 220,
            }}
          />
          <button
            disabled={pending || !value}
            onClick={create}
            style={{
              height: 48,
              padding: '0 20px',
              borderRadius: 999,
              border: 0,
              background: value ? 'var(--nv-lime)' : 'var(--nv-surface-2)',
              color: value ? 'var(--nv-bg)' : 'var(--nv-faint)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {t('create')}
          </button>
        </div>
        {error && (
          <div style={{ fontSize: 13, color: 'var(--nv-err)' }}>{error}</div>
        )}
      </div>

      {/* list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <strong style={{ fontFamily: 'var(--font-display)' }}>
          {t('listTitle')}
        </strong>
        {slots.length === 0 ? (
          <p style={{ color: 'var(--nv-muted)' }}>{t('empty')}</p>
        ) : (
          slots.map((s) => {
            const tg = tag(s);
            const canClose = s.status === 'open' && !s.closed;
            const canOpen = s.closed;
            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'var(--nv-surface)',
                  border: '1px solid var(--nv-border)',
                }}
              >
                <span style={{ fontSize: 14 }}>{s.label}</span>
                <span
                  style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: tg.fg }}>
                    {tg.label}
                    {s.bookingReference ? (
                      <span
                        className="nv-mono"
                        style={{ color: 'var(--nv-faint)', marginLeft: 8 }}
                      >
                        {s.bookingReference}
                      </span>
                    ) : null}
                  </span>
                  {canClose && (
                    <button
                      disabled={pending}
                      onClick={() => toggle(s.id, true)}
                      style={toggleBtn}
                    >
                      {t('close')}
                    </button>
                  )}
                  {canOpen && (
                    <button
                      disabled={pending}
                      onClick={() => toggle(s.id, false)}
                      style={{
                        ...toggleBtn,
                        borderColor: 'var(--nv-lime)',
                        color: 'var(--nv-lime)',
                      }}
                    >
                      {t('open')}
                    </button>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const toggleBtn = {
  height: 32,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid var(--nv-border-strong)',
  background: 'transparent',
  color: 'var(--nv-ink)',
  fontSize: 13,
  fontWeight: 600,
};
