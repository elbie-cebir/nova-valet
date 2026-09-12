'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { findBookingAction } from '@/app/[locale]/find/actions';

const inputStyle = {
  height: 52,
  borderRadius: 14,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border-strong)',
  color: 'var(--nv-ink)',
  padding: '0 16px',
  fontSize: 16,
  width: '100%',
};

export function FindForm({ locale }: { locale: string }) {
  const t = useTranslations('Find');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reference, setReference] = useState('');
  const [contact, setContact] = useState('');
  const [notFound, setNotFound] = useState(false);

  const canSubmit = reference.trim().length > 0 && contact.trim().length > 0;

  function submit() {
    if (!canSubmit || pending) return;
    setNotFound(false);
    startTransition(async () => {
      const res = await findBookingAction({ reference, contact });
      if (res.ok) {
        router.push(`/booking/${res.token}`);
      } else {
        setNotFound(true);
      }
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>{t('refLabel')}</label>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t('refPh')}
          style={{
            ...inputStyle,
            fontFamily: 'var(--font-mono)',
            letterSpacing: '.06em',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          {t('contactLabel')}
        </label>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={t('contactPh')}
          style={inputStyle}
        />
      </div>
      <button
        onClick={submit}
        disabled={!canSubmit || pending}
        style={{
          height: 52,
          borderRadius: 999,
          border: 0,
          marginTop: 6,
          background:
            canSubmit && !pending ? 'var(--nv-lime)' : 'var(--nv-surface-2)',
          color: canSubmit && !pending ? 'var(--nv-bg)' : 'var(--nv-faint)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          cursor: canSubmit && !pending ? 'pointer' : 'not-allowed',
        }}
      >
        {t('open')}
      </button>
      {notFound && (
        <div style={{ fontSize: 13, color: 'var(--nv-err)' }}>
          {t('notFound')}
        </div>
      )}
    </div>
  );
}
