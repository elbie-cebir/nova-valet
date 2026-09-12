'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { startPaymentAction } from '@/app/[locale]/book/pending/[reference]/pay-actions';
import { BancontactIcon, CardBrands } from './payment-icons';

/**
 * Method picker (ADR-013): the POC lacks one, so we add Bancontact + card,
 * styled like a normal checkout (brand marks, name, subtitle, chevron). The
 * choice routes to Mollie or Stripe via the server action, which returns the
 * hosted checkout URL to redirect to.
 */
export function PaymentPicker({
  reference,
  locale,
  kind,
  token,
}: {
  reference: string;
  locale: string;
  kind: 'deposit' | 'balance';
  token?: string;
}) {
  const t = useTranslations('Checkout');
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<'bancontact' | 'card' | null>(null);
  const [error, setError] = useState('');

  function pay(method: 'bancontact' | 'card') {
    if (pending) return;
    setError('');
    setChosen(method);
    startTransition(async () => {
      const res = await startPaymentAction({
        reference,
        method,
        kind,
        locale,
        token,
      });
      if (res.ok) {
        window.location.href = res.checkoutUrl;
      } else {
        setError(t('error'));
        setChosen(null);
      }
    });
  }

  function methodRow(
    method: 'bancontact' | 'card',
    icon: React.ReactNode,
    name: string,
    sub: string,
  ) {
    const active = chosen === method;
    return (
      <button
        onClick={() => pay(method)}
        disabled={pending}
        aria-busy={active && pending}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          width: '100%',
          padding: '14px 16px',
          borderRadius: 14,
          border: `1px solid ${active ? 'var(--nv-lime)' : 'var(--nv-border-strong)'}`,
          background: 'var(--nv-surface)',
          color: 'var(--nv-ink)',
          textAlign: 'left',
          cursor: pending ? 'progress' : 'pointer',
          opacity: pending && !active ? 0.5 : 1,
        }}
      >
        <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 16,
            }}
          >
            {name}
          </span>
          <span style={{ fontSize: 12, color: 'var(--nv-muted)' }}>{sub}</span>
        </span>
        <span aria-hidden style={{ color: 'var(--nv-lime)', fontSize: 18 }}>
          {active && pending ? '…' : '›'}
        </span>
      </button>
    );
  }

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
      {methodRow(
        'bancontact',
        <BancontactIcon />,
        'Bancontact',
        t('bancontactSub'),
      )}
      {methodRow('card', <CardBrands />, t('card'), t('cardSub'))}
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
