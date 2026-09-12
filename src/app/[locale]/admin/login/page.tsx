import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect, Link } from '@/i18n/navigation';
import { getAuthenticatedOwner } from '@/lib/auth/owner';
import { LoginForm } from '@/components/admin/login-form';

/**
 * The ONLY admin route reachable without a session. If the owner is already
 * signed in, skip straight to the dashboard.
 */
export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (await getAuthenticatedOwner()) {
    redirect({ href: '/admin', locale });
  }

  const t = await getTranslations('Admin');

  return (
    <main
      style={{
        maxWidth: 440,
        width: '100%',
        margin: '0 auto',
        padding: '60px 24px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minHeight: '100dvh',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 12,
            height: 12,
            background: 'var(--nv-lime)',
            borderRadius: 3,
            boxShadow: '0 0 16px rgba(214,240,77,.7)',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: '-.02em',
          }}
        >
          Nova&nbsp;Valet
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: 'var(--nv-faint)',
            marginLeft: 4,
          }}
        >
          {t('owner')}
        </span>
      </div>

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(34px,4vw,48px)',
          lineHeight: 1,
          letterSpacing: '-.035em',
          margin: '20px 0 0',
        }}
      >
        {t('signIn')}
      </h1>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 14,
          color: 'var(--nv-muted)',
          lineHeight: 1.5,
        }}
      >
        {t('signInSub')}
      </p>

      <LoginForm locale={locale} />

      <div
        style={{ marginTop: 'auto', fontSize: 12, color: 'var(--nv-faint)' }}
      >
        <Link href="/" style={{ color: 'var(--nv-faint)' }}>
          ← Nova&nbsp;Valet
        </Link>
      </div>
    </main>
  );
}
