import { setRequestLocale } from 'next-intl/server';
import {
  getServicesWithFromPrice,
  getTiers,
  getAddOns,
  getPriceMatrix,
  getDepositCents,
} from '@/lib/content/reads';
import { BookingFlow } from '@/components/booking/booking-flow';

export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Cache-first content reads; the component receives plain data, never SQL.
  const [services, tiers, addOns, priceMatrix, depositCents] =
    await Promise.all([
      getServicesWithFromPrice(locale),
      getTiers(locale),
      getAddOns(locale),
      getPriceMatrix(),
      getDepositCents(),
    ]);

  const currency = priceMatrix[0]?.currency ?? 'EUR';

  return (
    <BookingFlow
      locale={locale}
      currency={currency}
      depositCents={depositCents}
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        desc: s.description,
        fromCents: s.fromCents,
      }))}
      tiers={tiers.map((t) => ({
        id: t.id,
        key: t.key,
        label: t.label,
        desc: t.desc,
      }))}
      addOns={addOns.map((a) => ({
        id: a.id,
        name: a.name,
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
