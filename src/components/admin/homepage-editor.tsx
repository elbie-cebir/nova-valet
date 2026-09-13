'use client';

import { useState, useTransition, useRef, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import type { HomepageAdmin } from '@/lib/data/homepage';
import {
  updateHomepageAction,
  uploadHomeImageAction,
} from '@/app/[locale]/admin/homepage/actions';

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

function LocaleRow({
  title,
  value,
  onChange,
  textarea,
}: {
  title: string;
  value: Loc;
  onChange: (v: Loc) => void;
  textarea?: boolean;
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
          gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
          gap: 8,
        }}
      >
        {cols.map(([k, cl]) => (
          <div
            key={k}
            style={{ display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            <span style={{ fontSize: 10, color: 'var(--nv-faint)' }}>{cl}</span>
            {textarea ? (
              <textarea
                style={{
                  ...input,
                  height: 70,
                  padding: 10,
                  resize: 'vertical',
                }}
                value={value[k]}
                onChange={(e) => onChange({ ...value, [k]: e.target.value })}
              />
            ) : (
              <input
                style={input}
                value={value[k]}
                onChange={(e) => onChange({ ...value, [k]: e.target.value })}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TextForm({ content }: { content: HomepageAdmin }) {
  const t = useTranslations('Admin');
  const [heroTitle, setHeroTitle] = useState<Loc>(content.heroTitle);
  const [heroSub, setHeroSub] = useState<Loc>(content.heroSub);
  const [areaSnippet, setAreaSnippet] = useState<Loc>(content.areaSnippet);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  return (
    <div style={card}>
      <LocaleRow
        title={t('homeHero')}
        value={heroTitle}
        onChange={setHeroTitle}
      />
      <LocaleRow
        title={t('homeHeroSub')}
        value={heroSub}
        onChange={setHeroSub}
        textarea
      />
      <LocaleRow
        title={t('homeArea')}
        value={areaSnippet}
        onChange={setAreaSnippet}
        textarea
      />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          disabled={pending}
          style={{ ...btn, opacity: pending ? 0.6 : 1 }}
          onClick={() =>
            start(async () => {
              const r = await updateHomepageAction({
                heroTitle,
                heroSub,
                areaSnippet,
              });
              setStatus(r.ok ? 'ok' : 'err');
            })
          }
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
    </div>
  );
}

function ImageUploader({
  field,
  title,
  currentUrl,
}: {
  field: 'before' | 'after';
  title: string;
  currentUrl: string | null;
}) {
  const t = useTranslations('Admin');
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  return (
    <div style={card}>
      <span style={lab}>{title}</span>
      <div
        style={{
          width: '100%',
          height: 160,
          borderRadius: 12,
          border: '1px solid var(--nv-border)',
          background: currentUrl
            ? `center/cover no-repeat url(${currentUrl})`
            : 'var(--nv-surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--nv-faint)',
          fontSize: 13,
        }}
      >
        {currentUrl ? '' : t('homeNoImage')}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ fontSize: 13, color: 'var(--nv-muted)' }}
      />
      <div style={{ fontSize: 11, color: 'var(--nv-faint)' }}>
        {t('homeImageHelp')}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          disabled={pending}
          style={{ ...btn, opacity: pending ? 0.6 : 1 }}
          onClick={() =>
            start(async () => {
              const file = fileRef.current?.files?.[0];
              if (!file) {
                setStatus('err');
                return;
              }
              const fd = new FormData();
              fd.append('field', field);
              fd.append('file', file);
              const r = await uploadHomeImageAction(fd);
              setStatus(r.ok ? 'ok' : 'err');
            })
          }
        >
          {pending ? t('homeUploading') : t('homeUpload')}
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
    </div>
  );
}

export function HomepageEditor({ content }: { content: HomepageAdmin }) {
  const t = useTranslations('Admin');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TextForm content={content} />
      <h2 style={h2}>{t('homeImages')}</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
          gap: 10,
        }}
      >
        <ImageUploader
          field="before"
          title={t('homeBefore')}
          currentUrl={content.beforeImageUrl}
        />
        <ImageUploader
          field="after"
          title={t('homeAfter')}
          currentUrl={content.afterImageUrl}
        />
      </div>
    </div>
  );
}
