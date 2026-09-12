'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { startPaymentAction } from '@/app/[locale]/book/pending/[reference]/pay-actions';

/**
 * Method picker (ADR-013): the POC lacks one, so we add Bancontact + card. The
 * choice routes to Mollie or Stripe via the server action, which returns the
 * hosted checkout URL to redirect to.
 */
export function PaymentPicker({
  reference,
  locale,
  kind,
}: {
  reference: string;
  locale: string;
  kind: 'deposit' | 'balance';
}) {
  const t = useTranslations('Checkout');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function pay(method: 'bancontact' | 'card') {
    setError('');
    startTransition(async () => {
      const res = await startPaymentAction({ reference, method, kind, locale });
      if (res.ok) {
        window.location.href = res.checkoutUrl;
      } else {
        setError(t('error'));
      }
    });
  }

  const option = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    height: 56,
    padding: '0 20px',
    borderRadius: 14,
    border: '1px solid var(--nv-border-strong)',
    background: 'var(--nv-surface)',
    color: 'var(--nv-ink)',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 16,
    cursor: pending ? 'not-allowed' : 'pointer',
    opacity: pending ? 0.6 : 1,
    width: '100%',
  } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          fontSize: 12,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'var(--nv-muted)',
          fontWeight: 600,
        }}
      >
        {t('chooseMethod')}
      </div>
      <button
        onClick={() => pay('bancontact')}
        disabled={pending}
        style={option}
      >
        <span>Bancontact</span>
        <span aria-hidden style={{ color: 'var(--nv-lime)' }}>
          ›
        </span>
      </button>
      <button onClick={() => pay('card')} disabled={pending} style={option}>
        <span>{t('card')}</span>
        <span aria-hidden style={{ color: 'var(--nv-lime)' }}>
          ›
        </span>
      </button>
      {pending && (
        <div style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
          {t('redirecting')}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 13, color: 'var(--nv-err)' }}>{error}</div>
      )}
      <div
        style={{ fontSize: 12, color: 'var(--nv-faint)', textAlign: 'center' }}
      >
        {t('methodsNote')}
      </div>
    </div>
  );
}
