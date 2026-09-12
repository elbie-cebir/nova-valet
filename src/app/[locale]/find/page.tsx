import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FindForm } from '@/components/booking/find-form';

export default async function FindPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Find');

  return (
    <main
      style={{
        maxWidth: 560,
        width: '100%',
        margin: '0 auto',
        padding: '40px 20px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{ fontSize: 'clamp(30px,4vw,44px)', lineHeight: 1.05 }}>
          {t('title')}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.5,
            color: 'var(--nv-muted)',
          }}
        >
          {t('sub')}
        </p>
      </div>
      <FindForm locale={locale} />
    </main>
  );
}
