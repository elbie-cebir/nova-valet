import type { Queryable } from './types';

/** Pick the value for a locale from the three per-locale columns (nl default). */
function pick(loc: string, nl: string, en: string, fr: string): string {
  return loc === 'en' ? en : loc === 'fr' ? fr : nl;
}

export interface Service {
  id: string;
  key: string;
  name: string;
  description: string;
}

export interface Tier {
  id: string;
  key: string;
  label: string;
  desc: string;
  sortOrder: number;
}

export interface AddOn {
  id: string;
  key: string;
  name: string;
  amountCents: number;
}

/** A service paired with its cheapest tier price — the "from" figure. */
export interface ServiceFromPrice extends Service {
  fromCents: number;
  currency: string;
}

/** A service paired with its price at one specific tier. */
export interface ServiceTierPrice extends Service {
  amountCents: number;
  currency: string;
}

const SERVICE_COLS = `s.id, s.key,
  s.name_nl, s.name_en, s.name_fr,
  s.desc_nl, s.desc_en, s.desc_fr`;

interface ServiceRow {
  id: string;
  key: string;
  name_nl: string;
  name_en: string;
  name_fr: string;
  desc_nl: string;
  desc_en: string;
  desc_fr: string;
}

function toService(r: ServiceRow, loc: string): Service {
  return {
    id: r.id,
    key: r.key,
    name: pick(loc, r.name_nl, r.name_en, r.name_fr),
    description: pick(loc, r.desc_nl, r.desc_en, r.desc_fr),
  };
}

/**
 * Active services with their "from" price (cheapest tier), cheapest first. A
 * service with no price row is omitted — there is nothing to book without a
 * price. Names/descriptions are returned already localized to `locale`.
 */
export async function getServicesWithFromPrice(
  db: Queryable,
  locale: string,
): Promise<ServiceFromPrice[]> {
  const { rows } = await db.query<
    ServiceRow & { from_cents: number; currency: string }
  >(
    `select ${SERVICE_COLS},
            min(p.amount_cents) as from_cents,
            min(p.currency) as currency
     from service s
     join price p on p.service_id = s.id
     where s.active
     group by s.id, s.key, s.name_nl, s.name_en, s.name_fr,
              s.desc_nl, s.desc_en, s.desc_fr
     order by from_cents asc, s.key asc`,
  );
  return rows.map((r) => ({
    ...toService(r, locale),
    fromCents: Number(r.from_cents),
    currency: r.currency,
  }));
}

/**
 * Every active service with its price at the given vehicle-size tier, ordered
 * cheapest first. Drives the prices screen once a tier is selected.
 */
export async function getServicePricesForTier(
  db: Queryable,
  locale: string,
  tierKey: string,
): Promise<ServiceTierPrice[]> {
  const { rows } = await db.query<
    ServiceRow & { amount_cents: number; currency: string }
  >(
    `select ${SERVICE_COLS}, p.amount_cents, p.currency
     from service s
     join price p on p.service_id = s.id
     join vehicle_size_tier t on t.id = p.vehicle_size_tier_id
     where s.active and t.key = $1
     order by p.amount_cents asc, s.key asc`,
    [tierKey],
  );
  return rows.map((r) => ({
    ...toService(r, locale),
    amountCents: Number(r.amount_cents),
    currency: r.currency,
  }));
}

/** Every service × tier price, for the booking flow's live price display. */
export async function getPriceMatrix(db: Queryable): Promise<
  {
    serviceId: string;
    sizeKey: string;
    amountCents: number;
    currency: string;
  }[]
> {
  const { rows } = await db.query<{
    service_id: string;
    size_key: string;
    amount_cents: number;
    currency: string;
  }>(
    `select p.service_id, t.key as size_key, p.amount_cents, p.currency
     from price p
     join vehicle_size_tier t on t.id = p.vehicle_size_tier_id`,
  );
  return rows.map((r) => ({
    serviceId: r.service_id,
    sizeKey: r.size_key,
    amountCents: Number(r.amount_cents),
    currency: r.currency,
  }));
}

/** Vehicle-size tiers in display order, labels localized to `locale`. */
export async function getTiers(db: Queryable, locale: string): Promise<Tier[]> {
  const { rows } = await db.query<{
    id: string;
    key: string;
    label_nl: string;
    label_en: string;
    label_fr: string;
    desc_nl: string;
    desc_en: string;
    desc_fr: string;
    sort_order: number;
  }>(
    `select id, key, label_nl, label_en, label_fr,
            desc_nl, desc_en, desc_fr, sort_order
     from vehicle_size_tier
     order by sort_order asc`,
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    label: pick(locale, r.label_nl, r.label_en, r.label_fr),
    desc: pick(locale, r.desc_nl, r.desc_en, r.desc_fr),
    sortOrder: Number(r.sort_order),
  }));
}

/** Active add-ons, cheapest first, names localized to `locale`. */
export async function getAddOns(
  db: Queryable,
  locale: string,
): Promise<AddOn[]> {
  const { rows } = await db.query<{
    id: string;
    key: string;
    name_nl: string;
    name_en: string;
    name_fr: string;
    amount_cents: number;
  }>(
    `select id, key, name_nl, name_en, name_fr, amount_cents
     from add_on
     where active
     order by amount_cents asc, key asc`,
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: pick(locale, r.name_nl, r.name_en, r.name_fr),
    amountCents: Number(r.amount_cents),
  }));
}
