import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
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

  const t = await getTranslations('Admin.login');

  return (
    <main
      style={{
        maxWidth: 420,
        width: '100%',
        margin: '0 auto',
        padding: '48px 20px 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <h1 style={{ fontSize: 'clamp(26px,3.4vw,36px)', lineHeight: 1.05 }}>
          {t('title')}
        </h1>
        <p style={{ color: 'var(--nv-muted)', marginTop: 8, fontSize: 15 }}>
          {t('sub')}
        </p>
      </div>
      <LoginForm locale={locale} />
    </main>
  );
}
