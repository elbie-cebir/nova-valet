'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  rescheduleAction,
  cancelAction,
  completeAction,
  type ActionResult,
} from '@/app/[locale]/admin/actions';

const btn = {
  height: 46,
  borderRadius: 12,
  border: '1px solid var(--nv-border-strong)',
  background: 'var(--nv-surface)',
  color: 'var(--nv-ink)',
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 15,
  padding: '0 16px',
};

export function BookingActions({
  reference,
  status,
  openSlots,
}: {
  reference: string;
  status: string;
  openSlots: { id: string; label: string }[];
}) {
  const t = useTranslations('Admin.actions');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [slotId, setSlotId] = useState('');

  // Only a live booking can be acted on.
  const isConfirmed = status === 'confirmed';
  const isPending = status === 'pending_deposit';
  const canAct = isConfirmed || isPending;
  if (!canAct) return null;

  function run(fn: () => Promise<ActionResult>) {
    if (pending) return;
    setError(false);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(true);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          fontSize: 12,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'var(--nv-muted)',
          fontWeight: 600,
        }}
      >
        {t('title')}
      </div>

      {isConfirmed && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
              {t('rescheduleTo')}
            </label>
            {openSlots.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--nv-faint)' }}>
                {t('noOpenSlots')}
              </span>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={slotId}
                  onChange={(e) => setSlotId(e.target.value)}
                  style={{ ...btn, flex: 1, minWidth: 200 }}
                >
                  <option value="">—</option>
                  {openSlots.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  disabled={pending || !slotId}
                  onClick={() =>
                    run(() =>
                      rescheduleAction({ reference, newSlotId: slotId }),
                    )
                  }
                  style={{
                    ...btn,
                    borderColor: 'var(--nv-lime)',
                    color: slotId ? 'var(--nv-lime)' : 'var(--nv-faint)',
                  }}
                >
                  {t('rescheduleSubmit')}
                </button>
              </div>
            )}
          </div>

          <button
            disabled={pending}
            onClick={() => run(() => completeAction({ reference }))}
            style={{
              ...btn,
              background: 'var(--nv-lime)',
              color: 'var(--nv-bg)',
              border: 0,
            }}
          >
            {t('complete')}
          </button>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          disabled={pending}
          onClick={() => run(() => cancelAction({ reference }))}
          style={{
            ...btn,
            borderColor: 'var(--nv-err)',
            color: 'var(--nv-err)',
          }}
        >
          {t('cancel')}
        </button>
        <span style={{ fontSize: 12, color: 'var(--nv-faint)' }}>
          {t('cancelNote')}
        </span>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: 'var(--nv-err)' }}>{t('error')}</div>
      )}
    </div>
  );
}
