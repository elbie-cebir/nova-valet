'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import type { PostcodeArea } from '@/lib/data/area-admin';
import {
  createAreaAction,
  updateAreaAction,
  deleteAreaAction,
  type ActionResult,
} from '@/app/[locale]/admin/area/actions';

const toEuros = (c: number) => (c / 100).toFixed(2);
const toCents = (s: string) => {
  const n = Math.round(parseFloat(s.replace(',', '.')) * 100);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

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
  borderRadius: 14,
  padding: 14,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border)',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  alignItems: 'flex-end',
};
const lab: CSSProperties = {
  fontSize: 11,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--nv-muted)',
  fontWeight: 600,
};
const btn = (bg: string, fg: string): CSSProperties => ({
  height: 40,
  padding: '0 16px',
  borderRadius: 999,
  border: 0,
  background: bg,
  color: fg,
  fontFamily: 'var(--font-display)',
  fontWeight: 700,
  fontSize: 13,
});

function Field({
  title,
  width,
  children,
}: {
  title: string;
  width: number;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, width }}>
      <span style={lab}>{title}</span>
      {children}
    </label>
  );
}

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

function StatusText({ status }: { status: 'idle' | 'ok' | 'err' }) {
  const t = useTranslations('Admin');
  if (status === 'ok')
    return (
      <span style={{ color: 'var(--nv-lime)', fontSize: 13 }}>
        {t('catSaved')}
      </span>
    );
  if (status === 'err')
    return (
      <span style={{ color: 'var(--nv-err)', fontSize: 13 }}>
        {t('catError')}
      </span>
    );
  return null;
}

function AreaRow({ area }: { area: PostcodeArea }) {
  const t = useTranslations('Admin');
  const [prefix, setPrefix] = useState(area.prefix);
  const [fee, setFee] = useState(toEuros(area.travelFeeCents));
  const [inArea, setInArea] = useState(area.inArea);
  const save = useStatus();
  const del = useStatus();
  return (
    <div style={card}>
      <Field title={t('areaPrefix')} width={140}>
        <input
          style={input}
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
        />
      </Field>
      <Field title={t('areaFee')} width={140}>
        <input
          style={input}
          inputMode="decimal"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />
      </Field>
      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: 14,
          height: 40,
        }}
      >
        <input
          type="checkbox"
          checked={inArea}
          onChange={(e) => setInArea(e.target.checked)}
        />
        {t('areaInArea')}
      </label>
      <button
        type="button"
        disabled={save.pending}
        style={btn('var(--nv-lime)', 'var(--nv-bg)')}
        onClick={() =>
          save.run(() =>
            updateAreaAction({
              id: area.id,
              prefix,
              travelFeeCents: toCents(fee),
              inArea,
            }),
          )
        }
      >
        {save.pending ? t('catSaving') : t('catSave')}
      </button>
      <button
        type="button"
        disabled={del.pending}
        style={btn('var(--nv-surface-2)', 'var(--nv-err)')}
        onClick={() => del.run(() => deleteAreaAction({ id: area.id }))}
      >
        {t('areaDelete')}
      </button>
      <StatusText status={save.status === 'idle' ? del.status : save.status} />
    </div>
  );
}

function NewAreaForm() {
  const t = useTranslations('Admin');
  const [prefix, setPrefix] = useState('');
  const [fee, setFee] = useState('0.00');
  const [inArea, setInArea] = useState(true);
  const { pending, status, run } = useStatus();
  return (
    <div style={{ ...card, borderStyle: 'dashed' }}>
      <div style={{ ...lab, width: '100%' }}>{t('areaNew')}</div>
      <Field title={t('areaPrefix')} width={140}>
        <input
          style={input}
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          placeholder="1000"
        />
      </Field>
      <Field title={t('areaFee')} width={140}>
        <input
          style={input}
          inputMode="decimal"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
        />
      </Field>
      <label
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          fontSize: 14,
          height: 40,
        }}
      >
        <input
          type="checkbox"
          checked={inArea}
          onChange={(e) => setInArea(e.target.checked)}
        />
        {t('areaInArea')}
      </label>
      <button
        type="button"
        disabled={pending}
        style={btn('var(--nv-lime)', 'var(--nv-bg)')}
        onClick={() =>
          run(() =>
            createAreaAction({ prefix, travelFeeCents: toCents(fee), inArea }),
          )
        }
      >
        {pending ? t('catSaving') : t('areaAdd')}
      </button>
      <StatusText status={status} />
    </div>
  );
}

export function AreaEditor({ areas }: { areas: PostcodeArea[] }) {
  const t = useTranslations('Admin');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {areas.length === 0 && (
        <div style={{ color: 'var(--nv-muted)', fontSize: 14 }}>
          {t('areaEmpty')}
        </div>
      )}
      {areas.map((a) => (
        <AreaRow key={a.id} area={a} />
      ))}
      <NewAreaForm />
    </div>
  );
}
