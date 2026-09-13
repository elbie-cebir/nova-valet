import type { Queryable } from './types';

/**
 * Owner catalog management (B9 PART A). Read the FULL per-locale catalog for the
 * admin editor, and the mutations behind it. All mutations are called only from
 * owner-guarded server actions, which parse input (Zod) and revalidate the
 * `catalog` cache tag afterwards. Add-ons are soft-deleted (active=false) because
 * historical bookings reference them.
 */

export interface AdminService {
  id: string;
  key: string;
  active: boolean;
  nameNl: string;
  nameEn: string;
  nameFr: string;
  descNl: string;
  descEn: string;
  descFr: string;
}

export interface AdminTier {
  id: string;
  key: string;
  sortOrder: number;
  labelNl: string;
  labelEn: string;
  labelFr: string;
  descNl: string;
  descEn: string;
  descFr: string;
}

export interface AdminAddOn {
  id: string;
  key: string;
  active: boolean;
  amountCents: number;
  nameNl: string;
  nameEn: string;
  nameFr: string;
}

export interface AdminPriceCell {
  serviceId: string;
  tierId: string;
  tierKey: string;
  amountCents: number;
}

export interface LocaleText {
  nl: string;
  en: string;
  fr: string;
}

export async function getAdminServices(db: Queryable): Promise<AdminService[]> {
  const { rows } = await db.query<{
    id: string;
    key: string;
    active: boolean;
    name_nl: string;
    name_en: string;
    name_fr: string;
    desc_nl: string;
    desc_en: string;
    desc_fr: string;
  }>(
    `select id, key, active, name_nl, name_en, name_fr, desc_nl, desc_en, desc_fr
     from service order by key asc`,
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    active: r.active,
    nameNl: r.name_nl,
    nameEn: r.name_en,
    nameFr: r.name_fr,
    descNl: r.desc_nl,
    descEn: r.desc_en,
    descFr: r.desc_fr,
  }));
}

export async function getAdminTiers(db: Queryable): Promise<AdminTier[]> {
  const { rows } = await db.query<{
    id: string;
    key: string;
    sort_order: number;
    label_nl: string;
    label_en: string;
    label_fr: string;
    desc_nl: string;
    desc_en: string;
    desc_fr: string;
  }>(
    `select id, key, sort_order, label_nl, label_en, label_fr, desc_nl, desc_en, desc_fr
     from vehicle_size_tier order by sort_order asc`,
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    sortOrder: Number(r.sort_order),
    labelNl: r.label_nl,
    labelEn: r.label_en,
    labelFr: r.label_fr,
    descNl: r.desc_nl,
    descEn: r.desc_en,
    descFr: r.desc_fr,
  }));
}

export async function getAdminAddOns(db: Queryable): Promise<AdminAddOn[]> {
  const { rows } = await db.query<{
    id: string;
    key: string;
    active: boolean;
    amount_cents: number;
    name_nl: string;
    name_en: string;
    name_fr: string;
  }>(
    `select id, key, active, amount_cents, name_nl, name_en, name_fr
     from add_on order by amount_cents asc, key asc`,
  );
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    active: r.active,
    amountCents: Number(r.amount_cents),
    nameNl: r.name_nl,
    nameEn: r.name_en,
    nameFr: r.name_fr,
  }));
}

export async function getAdminPriceMatrix(
  db: Queryable,
): Promise<AdminPriceCell[]> {
  const { rows } = await db.query<{
    service_id: string;
    tier_id: string;
    tier_key: string;
    amount_cents: number;
  }>(
    `select p.service_id, p.vehicle_size_tier_id as tier_id,
            t.key as tier_key, p.amount_cents
     from price p join vehicle_size_tier t on t.id = p.vehicle_size_tier_id`,
  );
  return rows.map((r) => ({
    serviceId: r.service_id,
    tierId: r.tier_id,
    tierKey: r.tier_key,
    amountCents: Number(r.amount_cents),
  }));
}

// ── mutations ───────────────────────────────────────────────────────────────

export async function updateService(
  db: Queryable,
  id: string,
  v: { name: LocaleText; desc: LocaleText; active: boolean },
): Promise<void> {
  await db.query(
    `update service set
       name_nl=$2, name_en=$3, name_fr=$4,
       desc_nl=$5, desc_en=$6, desc_fr=$7, active=$8
     where id=$1`,
    [
      id,
      v.name.nl,
      v.name.en,
      v.name.fr,
      v.desc.nl,
      v.desc.en,
      v.desc.fr,
      v.active,
    ],
  );
}

export async function updateTier(
  db: Queryable,
  id: string,
  v: { label: LocaleText; desc: LocaleText },
): Promise<void> {
  await db.query(
    `update vehicle_size_tier set
       label_nl=$2, label_en=$3, label_fr=$4,
       desc_nl=$5, desc_en=$6, desc_fr=$7
     where id=$1`,
    [id, v.label.nl, v.label.en, v.label.fr, v.desc.nl, v.desc.en, v.desc.fr],
  );
}

/** Upsert one service×tier price cell. */
export async function upsertPrice(
  db: Queryable,
  serviceId: string,
  tierId: string,
  amountCents: number,
): Promise<void> {
  await db.query(
    `insert into price (service_id, vehicle_size_tier_id, amount_cents, currency)
     values ($1, $2, $3, 'EUR')
     on conflict (service_id, vehicle_size_tier_id)
       do update set amount_cents = excluded.amount_cents`,
    [serviceId, tierId, amountCents],
  );
}

export async function createAddOn(
  db: Queryable,
  v: { key: string; name: LocaleText; amountCents: number },
): Promise<void> {
  await db.query(
    `insert into add_on (key, name_nl, name_en, name_fr, amount_cents, active)
     values ($1, $2, $3, $4, $5, true)`,
    [v.key, v.name.nl, v.name.en, v.name.fr, v.amountCents],
  );
}

export async function updateAddOn(
  db: Queryable,
  id: string,
  v: { name: LocaleText; amountCents: number; active: boolean },
): Promise<void> {
  await db.query(
    `update add_on set name_nl=$2, name_en=$3, name_fr=$4, amount_cents=$5, active=$6
     where id=$1`,
    [id, v.name.nl, v.name.en, v.name.fr, v.amountCents, v.active],
  );
}
