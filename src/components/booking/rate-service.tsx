'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { guestReviewAction } from '@/app/[locale]/booking/[token]/actions';

const card: CSSProperties = {
  borderRadius: 20,
  padding: 22,
  background: 'var(--nv-surface)',
  border: '1px solid var(--nv-border)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

/**
 * Customer "rate your service" — shown on the guest booking view once the booking
 * is fully paid. Star rating (required) + optional note; submits token-scoped and
 * the review is held unpublished for owner approval. When already submitted, the
 * parent renders the thank-you instead of this form.
 */
export function RateService({ token }: { token: string }) {
  const t = useTranslations('BookingView');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  if (done) {
    return (
      <div style={card}>
        <strong>{t('rateThanks')}</strong>
      </div>
    );
  }

  const shown = hover || rating;

  return (
    <div style={card}>
      <strong>{t('rateTitle')}</strong>
      <div style={{ fontSize: 13, color: 'var(--nv-muted)' }}>
        {t('ratePrompt')}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} ${t('rateStar')}`}
            aria-pressed={rating === n}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            style={{
              border: 0,
              background: 'none',
              padding: 2,
              fontSize: 30,
              lineHeight: 1,
              cursor: 'pointer',
              color: n <= shown ? 'var(--nv-lime)' : 'var(--nv-faint)',
            }}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('ratePlaceholder')}
        rows={3}
        style={{
          borderRadius: 12,
          background: 'var(--nv-surface-2)',
          border: '1px solid var(--nv-border-strong)',
          color: 'var(--nv-ink)',
          padding: 12,
          fontSize: 14,
          fontFamily: 'inherit',
          resize: 'vertical',
        }}
      />
      {error && (
        <div style={{ color: 'var(--nv-err)', fontSize: 13 }}>
          {t('rateError')}
        </div>
      )}
      <button
        type="button"
        disabled={pending || rating === 0}
        onClick={() =>
          start(async () => {
            setError(false);
            const res = await guestReviewAction({ token, rating, body });
            if (res.ok || res.reason === 'already_reviewed') setDone(true);
            else setError(true);
          })
        }
        style={{
          alignSelf: 'flex-start',
          height: 46,
          padding: '0 22px',
          borderRadius: 999,
          border: 0,
          background: 'var(--nv-lime)',
          color: 'var(--nv-bg)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 15,
          opacity: pending || rating === 0 ? 0.5 : 1,
        }}
      >
        {pending ? t('rateSending') : t('rateSubmit')}
      </button>
    </div>
  );
}
