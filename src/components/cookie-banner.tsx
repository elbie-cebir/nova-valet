'use client';

import { useEffect, useState } from 'react';
import { usePathname } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';

const STORAGE_KEY = 'nv-cookie-consent';

/**
 * Cookie-consent bar. Text is owner-managed (passed in, already localized). The
 * visitor's choice is remembered in localStorage; the bar hides on the owner
 * admin. Choosing "decline" simply records the choice — the site uses only
 * essential cookies.
 */
export function CookieBanner({
  text,
  acceptLabel,
  declineLabel,
  privacyLabel,
}: {
  text: string;
  acceptLabel: string;
  declineLabel: string;
  privacyLabel: string;
}) {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setShow(true);
  }, []);

  if (!show || pathname.startsWith('/admin')) return null;

  const choose = (v: 'accepted' | 'declined') => {
    localStorage.setItem(STORAGE_KEY, v);
    setShow(false);
  };

  return (
    <div
      role="dialog"
      aria-label="cookie"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 50,
        maxWidth: 720,
        margin: '0 auto',
        padding: '14px 16px',
        borderRadius: 16,
        background: 'rgba(11,12,10,.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--nv-border-strong)',
        boxShadow: '0 20px 50px -20px rgba(0,0,0,.8)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 220,
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--nv-muted)',
        }}
      >
        {text}{' '}
        <Link
          href="/privacy"
          style={{ color: 'var(--nv-lime)', fontWeight: 600 }}
        >
          {privacyLabel}
        </Link>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => choose('declined')}
          style={{
            height: 38,
            padding: '0 16px',
            borderRadius: 999,
            border: '1px solid var(--nv-border-strong)',
            background: 'var(--nv-surface-2)',
            color: 'var(--nv-ink)',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {declineLabel}
        </button>
        <button
          type="button"
          onClick={() => choose('accepted')}
          style={{
            height: 38,
            padding: '0 18px',
            borderRadius: 999,
            border: 0,
            background: 'var(--nv-lime)',
            color: 'var(--nv-bg)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {acceptLabel}
        </button>
      </div>
    </div>
  );
}
