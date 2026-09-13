import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getLegalContent, getBusinessDetails } from '@/lib/content/reads';
import { LegalView } from '@/components/legal-view';

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Legal');
  const [legal, business] = await Promise.all([
    getLegalContent(locale),
    getBusinessDetails(),
  ]);

  return (
    <LegalView
      title={t('termsTitle')}
      body={legal?.terms ?? ''}
      backLabel={t('backHome')}
      business={business}
    />
  );
}
