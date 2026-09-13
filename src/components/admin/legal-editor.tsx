'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import type { LegalAdmin } from '@/lib/data/legal';
import type { BusinessDetails } from '@/lib/data/business';
import {
  updateLegalAction,
  updateBusinessAction,
  type ActionResult,
} from '@/app/[locale]/admin/legal/actions';

type Loc = { nl: string; en: string; fr: string };

const input: CSSProperties = {
  height: 40,
  borderRadius: 10,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border-strong)',
  color: 'var(--nv-ink)',
  padding: '0 12px',
  fontSize: 14,
  width: '100%',
};
const card: CSSProperties = {
  borderRadius: 16,
  padding: 18,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};
const lab: CSSProperties = {
  fontSize: 11,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--nv-muted)',
  fontWeight: 600,
};
const btn: CSSProperties = {
  alignSelf: 'flex-start',
  height: 40,
  padding: '0 18px',
  borderRadius: 999,
  border: 0,
  background: 'var(--nv-lime)',
  color: 'var(--nv-bg)',
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 14,
};
const h2: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: 20,
  letterSpacing: '-.02em',
  margin: '8px 0 0',
};

function useStatus() {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setStatus(r.ok ? 'ok' : 'err');
    });
  return { pending, status, run };
}

function StatusBtn({
  pending,
  status,
  onClick,
}: {
  pending: boolean;
  status: 'idle' | 'ok' | 'err';
  onClick: () => void;
}) {
  const t = useTranslations('Admin');
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <button
        type="button"
        disabled={pending}
        style={{ ...btn, opacity: pending ? 0.6 : 1 }}
        onClick={onClick}
      >
        {pending ? t('catSaving') : t('catSave')}
      </button>
      {status === 'ok' && (
        <span style={{ color: 'var(--nv-lime)', fontSize: 13 }}>
          {t('catSaved')}
        </span>
      )}
      {status === 'err' && (
        <span style={{ color: 'var(--nv-err)', fontSize: 13 }}>
          {t('catError')}
        </span>
      )}
    </div>
  );
}

function LocaleTextareas({
  title,
  value,
  onChange,
  rows,
}: {
  title: string;
  value: Loc;
  onChange: (v: Loc) => void;
  rows: number;
}) {
  const t = useTranslations('Admin');
  const cols = [
    ['nl', t('colNl')],
    ['en', t('colEn')],
    ['fr', t('colFr')],
  ] as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={lab}>{title}</span>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
          gap: 8,
        }}
      >
        {cols.map(([k, cl]) => (
          <div
            key={k}
            style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <span style={{ fontSize: 10, color: 'var(--nv-faint)' }}>{cl}</span>
            <textarea
              style={{
                ...input,
                height: rows * 22,
                padding: 10,
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
              value={value[k]}
              onChange={(e) => onChange({ ...value, [k]: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function LegalForm({ legal }: { legal: LegalAdmin }) {
  const t = useTranslations('Admin');
  const [privacy, setPrivacy] = useState<Loc>(legal.privacy);
  const [terms, setTerms] = useState<Loc>(legal.terms);
  const [cookie, setCookie] = useState<Loc>(legal.cookie);
  const { pending, status, run } = useStatus();
  return (
    <div style={card}>
      <LocaleTextareas
        title={t('legPrivacy')}
        value={privacy}
        onChange={setPrivacy}
        rows={8}
      />
      <LocaleTextareas
        title={t('legTerms')}
        value={terms}
        onChange={setTerms}
        rows={8}
      />
      <LocaleTextareas
        title={t('legCookie')}
        value={cookie}
        onChange={setCookie}
        rows={3}
      />
      <StatusBtn
        pending={pending}
        status={status}
        onClick={() => run(() => updateLegalAction({ privacy, terms, cookie }))}
      />
    </div>
  );
}

function BusinessForm({ business }: { business: BusinessDetails }) {
  const t = useTranslations('Admin');
  const [v, setV] = useState<BusinessDetails>(business);
  const { pending, status, run } = useStatus();
  const field = (
    title: string,
    key: keyof BusinessDetails,
    textarea?: boolean,
  ) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={lab}>{title}</span>
      {textarea ? (
        <textarea
          style={{ ...input, height: 60, padding: 10, resize: 'vertical' }}
          value={v[key]}
          onChange={(e) => setV({ ...v, [key]: e.target.value })}
        />
      ) : (
        <input
          style={input}
          value={v[key]}
          onChange={(e) => setV({ ...v, [key]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <div style={card}>
      {field(t('legName'), 'legalName')}
      {field(t('legAddress'), 'address', true)}
      {field(t('legVat'), 'vatNumber')}
      {field(t('legEmail'), 'contactEmail')}
      {field(t('legPhone'), 'contactPhone')}
      <StatusBtn
        pending={pending}
        status={status}
        onClick={() => run(() => updateBusinessAction(v))}
      />
    </div>
  );
}

export function LegalEditor({
  legal,
  business,
}: {
  legal: LegalAdmin;
  business: BusinessDetails;
}) {
  const t = useTranslations('Admin');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <LegalForm legal={legal} />
      <h2 style={h2}>{t('legBusiness')}</h2>
      <BusinessForm business={business} />
    </div>
  );
}
