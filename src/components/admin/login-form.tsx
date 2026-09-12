'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { signInAction } from '@/app/[locale]/admin/login/actions';

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

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations('Admin.login');
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  function submit() {
    if (!canSubmit || pending) return;
    setError(false);
    startTransition(async () => {
      // On success this redirects and never resolves; only failures return.
      const res = await signInAction({ email, password, locale });
      if (res && !res.ok) setError(true);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>{t('email')}</label>
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>{t('password')}</label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
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
        {t('submit')}
      </button>
      {error && (
        <div style={{ fontSize: 13, color: 'var(--nv-err)' }}>{t('error')}</div>
      )}
    </div>
  );
}
