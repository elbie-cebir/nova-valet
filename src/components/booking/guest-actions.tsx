'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  guestRescheduleAction,
  guestCancelAction,
} from '@/app/[locale]/booking/[token]/actions';

const card = {
  borderRadius: 18,
  padding: '16px 18px',
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border)',
};

export function GuestActions({
  token,
  canReschedule,
  cutoffLabel,
  currentSlotLabel,
  openSlots,
}: {
  token: string;
  canReschedule: boolean;
  cutoffLabel: string;
  currentSlotLabel: string;
  openSlots: { id: string; label: string }[];
}) {
  const t = useTranslations('Manage');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<'idle' | 'reschedule' | 'cancel'>('idle');
  const [slotId, setSlotId] = useState('');
  const [error, setError] = useState(false);

  function doReschedule() {
    if (pending || !slotId) return;
    setError(false);
    startTransition(async () => {
      const res = await guestRescheduleAction({ token, newSlotId: slotId });
      if (res.ok) router.refresh();
      else setError(true);
    });
  }
  function doCancel() {
    if (pending) return;
    setError(false);
    startTransition(async () => {
      const res = await guestCancelAction({ token });
      if (res.ok) router.refresh();
      else setError(true);
    });
  }

  // ── reschedule panel ──
  if (mode === 'reschedule') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 22, letterSpacing: '-.02em' }}>
          {t('moveTitle')}
        </h2>
        <div
          style={{
            ...card,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            background: 'rgba(214,240,77,.1)',
            border: '1px solid rgba(214,240,77,.3)',
            color: 'var(--nv-lime)',
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          {t('freeMove')}
        </div>
        <div
          style={{
            ...card,
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            fontSize: 14,
          }}
        >
          <span style={{ color: 'var(--nv-muted)' }}>{t('current')}</span>
          <span
            style={{ textDecoration: 'line-through', color: 'var(--nv-muted)' }}
          >
            {currentSlotLabel}
          </span>
        </div>

        <label style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
          {t('chooseSlot')}
        </label>
        {openSlots.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--nv-faint)' }}>
            {t('noSlots')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {openSlots.map((s) => {
              const active = s.id === slotId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSlotId(s.id)}
                  style={{
                    ...card,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    textAlign: 'left',
                    color: 'var(--nv-ink)',
                    borderColor: active ? 'var(--nv-lime)' : 'var(--nv-border)',
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      border: `2px solid ${active ? 'var(--nv-lime)' : 'var(--nv-border-strong)'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: 'var(--nv-lime)',
                        }}
                      />
                    )}
                  </span>
                  <span style={{ fontSize: 14 }}>{s.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div
          style={{ fontSize: 12, color: 'var(--nv-faint)', lineHeight: 1.5 }}
        >
          {t('moveNote')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            disabled={pending}
            onClick={() => {
              setMode('idle');
              setSlotId('');
            }}
            style={{ ...btnGhost, flex: 1 }}
          >
            {t('back')}
          </button>
          <button
            disabled={pending || !slotId}
            onClick={doReschedule}
            style={{
              ...btnPrimary,
              flex: 2,
              opacity: slotId ? 1 : 0.5,
            }}
          >
            {t('confirmMove')}
          </button>
        </div>
        {error && <ErrorLine text={t('error')} />}
      </div>
    );
  }

  // ── cancel confirm ──
  if (mode === 'cancel') {
    return (
      <div
        style={{
          ...card,
          background: 'rgba(255,120,110,.1)',
          border: '1px solid rgba(255,120,110,.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <strong style={{ fontSize: 20, letterSpacing: '-.02em' }}>
          {t('cancelQ')}
        </strong>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: 'var(--nv-err)',
          }}
        >
          {t('forfeited')} — {t('notRefundedBig')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--nv-err)', lineHeight: 1.5 }}>
          {t('forfeitNote')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {canReschedule && (
            <button
              disabled={pending}
              onClick={() => setMode('reschedule')}
              style={btnPrimary}
            >
              {t('rescheduleInstead')}
            </button>
          )}
          <button
            disabled={pending}
            onClick={doCancel}
            style={{
              ...btnGhost,
              borderColor: 'rgba(255,138,126,.7)',
              color: 'var(--nv-err)',
            }}
          >
            {t('cancelForfeit')}
          </button>
          <button
            disabled={pending}
            onClick={() => setMode('idle')}
            style={{ ...btnGhost, border: 0, color: 'var(--nv-muted)' }}
          >
            {t('keep')}
          </button>
        </div>
        {error && <ErrorLine text={t('error')} />}
      </div>
    );
  }

  // ── idle: entry buttons ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {canReschedule ? (
        <button onClick={() => setMode('reschedule')} style={rowBtn}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 600, fontSize: 16 }}>
              {t('reschedule')}
            </span>
            <span style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
              {t('freeUntil', { cutoff: cutoffLabel })}
            </span>
          </span>
          <span style={{ fontSize: 20, color: 'var(--nv-muted)' }}>›</span>
        </button>
      ) : (
        <div style={{ ...card, fontSize: 13, color: 'var(--nv-warn)' }}>
          {t('windowClosed')}
        </div>
      )}
      <button onClick={() => setMode('cancel')} style={rowBtn}>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 16 }}>
            {t('cancelBooking')}
          </span>
          <span style={{ fontSize: 13, color: 'var(--nv-warn)' }}>
            {t('notRefunded')}
          </span>
        </span>
        <span style={{ fontSize: 20, color: 'var(--nv-muted)' }}>›</span>
      </button>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: 'var(--nv-err)' }}>{text}</div>;
}

const rowBtn = {
  ...card,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  textAlign: 'left' as const,
  color: 'var(--nv-ink)',
  cursor: 'pointer',
};
const btnPrimary = {
  height: 50,
  borderRadius: 999,
  border: 0,
  background: 'var(--nv-lime)',
  color: 'var(--nv-bg)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 15,
};
const btnGhost = {
  height: 50,
  borderRadius: 999,
  border: '1px solid var(--nv-border-strong)',
  background: 'transparent',
  color: 'var(--nv-ink)',
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 15,
};
