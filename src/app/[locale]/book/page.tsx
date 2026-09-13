import { setRequestLocale } from 'next-intl/server';
import {
  getServicesWithFromPrice,
  getTiers,
  getAddOns,
  getPriceMatrix,
} from '@/lib/content/reads';
import { DEPOSIT_AMOUNT_CENTS } from '@/config/constants';
import { BookingFlow } from '@/components/booking/booking-flow';

export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Cache-first content reads; the component receives plain data, never SQL.
  const [services, tiers, addOns, priceMatrix] = await Promise.all([
    getServicesWithFromPrice(),
    getTiers(),
    getAddOns(),
    getPriceMatrix(),
  ]);

  const currency = priceMatrix[0]?.currency ?? 'EUR';

  return (
    <BookingFlow
      locale={locale}
      currency={currency}
      depositCents={DEPOSIT_AMOUNT_CENTS}
      services={services.map((s) => ({
        id: s.id,
        nameKey: s.nameKey,
        descKey: s.descriptionKey,
        fromCents: s.fromCents,
      }))}
      tiers={tiers.map((t) => ({ id: t.id, key: t.key, labelKey: t.labelKey }))}
      addOns={addOns.map((a) => ({
        id: a.id,
        nameKey: a.nameKey,
        amountCents: a.amountCents,
      }))}
      priceMatrix={priceMatrix.map((p) => ({
        serviceId: p.serviceId,
        sizeKey: p.sizeKey,
        amountCents: p.amountCents,
      }))}
    />
  );
}
