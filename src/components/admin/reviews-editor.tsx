'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import type { Review } from '@/lib/data/reviews';
import {
  createReviewAction,
  updateReviewAction,
  deleteReviewAction,
  type ActionResult,
} from '@/app/[locale]/admin/reviews/actions';

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
  flexDirection: 'column',
  gap: 10,
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
  children,
  grow,
}: {
  title: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        flex: grow ? 1 : undefined,
        minWidth: grow ? 200 : undefined,
      }}
    >
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

function Status({ status }: { status: 'idle' | 'ok' | 'err' }) {
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

function fields(t: (k: string) => string) {
  return { author: t('revAuthor'), body: t('revBody'), rating: t('revRating') };
}

function ReviewRow({ review }: { review: Review }) {
  const t = useTranslations('Admin');
  const f = fields(t);
  const [authorName, setAuthor] = useState(review.authorName);
  const [body, setBody] = useState(review.body);
  const [rating, setRating] = useState(
    review.rating === null ? '' : String(review.rating),
  );
  const [published, setPublished] = useState(review.published);
  const [sortOrder, setSort] = useState(String(review.sortOrder));
  const save = useStatus();
  const del = useStatus();
  return (
    <div style={card}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Field title={f.author} grow>
          <input
            style={input}
            value={authorName}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </Field>
        <Field title={f.rating}>
          <input
            style={{ ...input, width: 120 }}
            inputMode="numeric"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            placeholder="—"
          />
        </Field>
        <Field title={t('revOrder')}>
          <input
            style={{ ...input, width: 90 }}
            inputMode="numeric"
            value={sortOrder}
            onChange={(e) => setSort(e.target.value)}
          />
        </Field>
      </div>
      <Field title={f.body}>
        <textarea
          style={{ ...input, height: 70, padding: 10, resize: 'vertical' }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <label
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            fontSize: 14,
          }}
        >
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          {t('revPublished')}
        </label>
        <button
          type="button"
          disabled={save.pending}
          style={btn('var(--nv-lime)', 'var(--nv-bg)')}
          onClick={() =>
            save.run(() =>
              updateReviewAction({
                id: review.id,
                authorName,
                body,
                rating,
                published,
                sortOrder,
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
          onClick={() => del.run(() => deleteReviewAction({ id: review.id }))}
        >
          {t('revDelete')}
        </button>
        <Status status={save.status === 'idle' ? del.status : save.status} />
      </div>
    </div>
  );
}

function NewReviewForm() {
  const t = useTranslations('Admin');
  const f = fields(t);
  const [authorName, setAuthor] = useState('');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState('');
  const { pending, status, run } = useStatus();
  return (
    <div style={{ ...card, borderStyle: 'dashed' }}>
      <div style={lab}>{t('revNew')}</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Field title={f.author} grow>
          <input
            style={input}
            value={authorName}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </Field>
        <Field title={f.rating}>
          <input
            style={{ ...input, width: 120 }}
            inputMode="numeric"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            placeholder="—"
          />
        </Field>
      </div>
      <Field title={f.body}>
        <textarea
          style={{ ...input, height: 70, padding: 10, resize: 'vertical' }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          type="button"
          disabled={pending}
          style={btn('var(--nv-lime)', 'var(--nv-bg)')}
          onClick={() =>
            run(() =>
              createReviewAction({
                authorName,
                body,
                rating,
                published: true,
                sortOrder: 0,
              }),
            )
          }
        >
          {pending ? t('catSaving') : t('revAdd')}
        </button>
        <Status status={status} />
      </div>
    </div>
  );
}

export function ReviewsEditor({ reviews }: { reviews: Review[] }) {
  const t = useTranslations('Admin');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {reviews.length === 0 && (
        <div style={{ color: 'var(--nv-muted)', fontSize: 14 }}>
          {t('revEmpty')}
        </div>
      )}
      {reviews.map((r) => (
        <ReviewRow key={r.id} review={r} />
      ))}
      <NewReviewForm />
    </div>
  );
}
