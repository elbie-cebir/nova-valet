import type { Queryable } from './types';

export interface Service {
  id: string;
  key: string;
  nameKey: string;
  descriptionKey: string;
}

export interface Tier {
  id: string;
  key: string;
  labelKey: string;
  sortOrder: number;
}

export interface AddOn {
  id: string;
  key: string;
  nameKey: string;
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

/**
 * Active services with their "from" price (cheapest tier). Ordered cheapest
 * first so the catalog reads low-to-high. A service with no price row is
 * omitted — there is nothing to book without a price.
 */
export async function getServicesWithFromPrice(
  db: Queryable,
): Promise<ServiceFromPrice[]> {
  const { rows } = await db.query<{
    id: string;
    key: string;
    name_key: string;
    description_key: string;
    from_cents: number;
    currency: string;
  }>(
    `select s.id, s.key, s.name_key, s.description_key,
            min(p.amount_cents) as from_cents,
            min(p.currency) as currency
     from service s
     join price p on p.service_id = s.id
     where s.active
     group by s.id, s.key, s.name_key, s.description_key
     order by from_cents asc, s.key asc`,
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    nameKey: r.name_key,
    descriptionKey: r.description_key,
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
  tierKey: string,
): Promise<ServiceTierPrice[]> {
  const { rows } = await db.query<{
    id: string;
    key: string;
    name_key: string;
    description_key: string;
    amount_cents: number;
    currency: string;
  }>(
    `select s.id, s.key, s.name_key, s.description_key,
            p.amount_cents, p.currency
     from service s
     join price p on p.service_id = s.id
     join vehicle_size_tier t on t.id = p.vehicle_size_tier_id
     where s.active and t.key = $1
     order by p.amount_cents asc, s.key asc`,
    [tierKey],
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    nameKey: r.name_key,
    descriptionKey: r.description_key,
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

/** Vehicle-size tiers in display order. */
export async function getTiers(db: Queryable): Promise<Tier[]> {
  const { rows } = await db.query<{
    id: string;
    key: string;
    label_key: string;
    sort_order: number;
  }>(
    `select id, key, label_key, sort_order
     from vehicle_size_tier
     order by sort_order asc`,
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    labelKey: r.label_key,
    sortOrder: Number(r.sort_order),
  }));
}

/** Active add-ons, cheapest first. */
export async function getAddOns(db: Queryable): Promise<AddOn[]> {
  const { rows } = await db.query<{
    id: string;
    key: string;
    name_key: string;
    amount_cents: number;
  }>(
    `select id, key, name_key, amount_cents
     from add_on
     where active
     order by amount_cents asc, key asc`,
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    nameKey: r.name_key,
    amountCents: Number(r.amount_cents),
  }));
}
