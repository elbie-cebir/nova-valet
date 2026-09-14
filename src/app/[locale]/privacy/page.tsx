import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getLegalContent, getBusinessDetails } from '@/lib/content/reads';
import { LegalView } from '@/components/legal-view';
import { isPlaceholder } from '@/lib/content/placeholder';

export default async function PrivacyPage({
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
      title={t('privacyTitle')}
      body={
        isPlaceholder(legal?.privacy) ? t('beingFinalized') : legal!.privacy
      }
      backLabel={t('backHome')}
      business={business}
    />
  );
}
