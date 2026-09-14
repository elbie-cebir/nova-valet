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

const displayBtn = {
  height: 48,
  borderRadius: 999,
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  fontSize: 14,
  padding: '0 16px',
};

export function BookingActions({
  reference,
  status,
  isPast,
  balanceOutstanding,
  openSlots,
}: {
  reference: string;
  status: string;
  isPast: boolean;
  balanceOutstanding: boolean;
  openSlots: { id: string; label: string }[];
}) {
  const t = useTranslations('Admin');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  const [slotId, setSlotId] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const isConfirmed = status === 'confirmed';
  const isPending = status === 'pending_deposit';
  if (!isConfirmed && !isPending) return null;

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {isConfirmed && (
        <>
          {!isPast && (
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
                    style={{
                      ...displayBtn,
                      flex: 1,
                      minWidth: 180,
                      background: 'var(--nv-surface)',
                      border: '1px solid var(--nv-border-strong)',
                      color: 'var(--nv-ink)',
                    }}
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
                      ...displayBtn,
                      background: 'var(--nv-surface)',
                      border: '1px solid var(--nv-lime)',
                      color: slotId ? 'var(--nv-lime)' : 'var(--nv-faint)',
                    }}
                  >
                    {t('reschedule')}
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            disabled={pending}
            onClick={() => run(() => completeAction({ reference }))}
            style={{
              ...displayBtn,
              height: 52,
              background: 'var(--nv-ink)',
              border: 0,
              color: 'var(--nv-bg)',
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {t('markCompleted')}
          </button>
          {balanceOutstanding && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--nv-faint)',
                lineHeight: 1.5,
              }}
            >
              {t('completeWarn')}
            </div>
          )}
        </>
      )}

      {/* cancel + forfeit confirmation — hidden once the slot is past */}
      {!isPast &&
        (!confirmingCancel ? (
          <button
            disabled={pending}
            onClick={() => setConfirmingCancel(true)}
            style={{
              ...displayBtn,
              background: 'none',
              border: '1px solid rgba(255,138,126,.6)',
              color: 'var(--nv-err)',
            }}
          >
            {t('cancelBooking')}
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: 16,
              borderRadius: 16,
              background: 'rgba(255,120,110,.1)',
              border: '1px solid rgba(255,120,110,.4)',
            }}
          >
            <strong
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                color: 'var(--nv-ink)',
              }}
            >
              {t('cancelQ')}
            </strong>
            <div
              style={{
                fontSize: 13,
                color: 'var(--nv-muted)',
                lineHeight: 1.5,
              }}
            >
              {t('cancelSub')}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: 'var(--nv-err)',
              }}
            >
              {t('forfeited')}
            </div>
            <div
              style={{ fontSize: 13, color: 'var(--nv-err)', lineHeight: 1.5 }}
            >
              {t('forfeitNote')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                disabled={pending}
                onClick={() => run(() => cancelAction({ reference }))}
                style={{
                  ...displayBtn,
                  height: 50,
                  background: 'none',
                  border: '1px solid rgba(255,138,126,.7)',
                  color: 'var(--nv-err)',
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {t('cancelForfeit')}
              </button>
              <button
                onClick={() => setConfirmingCancel(false)}
                style={{
                  ...displayBtn,
                  height: 44,
                  background: 'none',
                  border: 0,
                  color: 'var(--nv-muted)',
                }}
              >
                {t('keep')}
              </button>
            </div>
          </div>
        ))}

      {error && (
        <div style={{ fontSize: 13, color: 'var(--nv-err)' }}>
          {t('actionError')}
        </div>
      )}
    </div>
  );
}
