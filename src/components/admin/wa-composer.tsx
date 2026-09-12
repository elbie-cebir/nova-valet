'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { buildWaLink } from '@/lib/whatsapp';

export interface WaTemplate {
  key: string;
  label: string;
  body: string;
}

/**
 * Owner-tap WhatsApp: pick a template (localized to the CUSTOMER's booking
 * locale, prepared server-side), tweak the message, and open a wa.me deep link
 * to the customer. No message is ever sent programmatically (manual adapter).
 */
export function WaComposer({
  phone,
  langLabel,
  templates,
}: {
  phone: string;
  langLabel: string;
  templates: WaTemplate[];
}) {
  const t = useTranslations('Admin');
  const [key, setKey] = useState(templates[0]?.key ?? '');
  const [body, setBody] = useState(templates[0]?.body ?? '');

  function pick(tpl: WaTemplate) {
    setKey(tpl.key);
    setBody(tpl.body);
  }

  const link = buildWaLink({ toPhone: phone, body });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            height: 56,
            borderRadius: 999,
            background: 'var(--nv-wa)',
            color: '#04140b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              background: 'rgba(255,255,255,.25)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            WA
          </span>
          {t('waCustomer')}
        </a>
      ) : null}

      <div
        style={{
          borderRadius: 18,
          padding: '14px 16px',
          background: 'var(--nv-surface)',
          border: '1px solid var(--nv-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--nv-muted)' }}>
          {t('prefilled', { lang: langLabel })}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            resize: 'vertical',
            fontSize: 14,
            lineHeight: 1.55,
            padding: '12px 14px',
            borderRadius: 12,
            background: 'rgba(0,0,0,.35)',
            border: '1px solid var(--nv-border)',
            color: 'var(--nv-ink)',
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {templates.map((tpl) => {
            const on = tpl.key === key;
            return (
              <button
                key={tpl.key}
                onClick={() => pick(tpl)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  border: on ? 0 : '1px solid var(--nv-border-strong)',
                  background: on ? 'var(--nv-ink)' : 'transparent',
                  color: on ? 'var(--nv-bg)' : 'var(--nv-muted)',
                }}
              >
                {tpl.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
