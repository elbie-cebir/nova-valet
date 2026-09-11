import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return <Home />;
}

function Home() {
  const t = useTranslations('Home');
  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100dvh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: '2rem', letterSpacing: '-0.02em' }}>
          Nova Valet
        </h1>
        <p style={{ marginTop: '0.75rem', color: '#555', maxWidth: '32ch' }}>
          {t('tagline')}
        </p>
      </div>
    </main>
  );
}
