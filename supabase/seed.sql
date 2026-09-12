-- B1/B2 seed — PLACEHOLDER DATA ONLY.
-- Every amount and postcode below is a placeholder for local development and
-- tests; none are real Nova Valet prices or service areas. Client to confirm
-- real values later. Human-facing strings are i18n KEYS only, never literal
-- copy — the next-intl message catalogues resolve them per locale.
--
-- The catalog shape (4 services, 4 vehicle tiers, 4 add-ons) mirrors the
-- Novavale POC so the catalog/pricing screens match the design reference.

-- Services -------------------------------------------------------------------
insert into service (key, name_key, description_key, active) values
  ('interior', 'Catalog.interior.name', 'Catalog.interior.desc', true),
  ('exterior', 'Catalog.exterior.name', 'Catalog.exterior.desc', true),
  ('both',     'Catalog.both.name',     'Catalog.both.desc',     true),
  ('full',     'Catalog.full.name',     'Catalog.full.desc',     true);

-- Vehicle size tiers ---------------------------------------------------------
insert into vehicle_size_tier (key, label_key, sort_order) values
  ('small',  'Tiers.small.label',  1),
  ('medium', 'Tiers.medium.label', 2),
  ('large',  'Tiers.large.label',  3),
  ('van',    'Tiers.van.label',    4);

-- Price matrix (service x tier) — PLACEHOLDER amounts in cents ---------------
insert into price (service_id, vehicle_size_tier_id, amount_cents, currency)
select s.id, t.id, p.amount_cents, 'EUR'
from (values
  ('interior', 'small',  3500),
  ('interior', 'medium', 4500),
  ('interior', 'large',  5500),
  ('interior', 'van',    6500),
  ('exterior', 'small',  3000),
  ('exterior', 'medium', 4000),
  ('exterior', 'large',  5000),
  ('exterior', 'van',    6000),
  ('both',     'small',  6000),
  ('both',     'medium', 7500),
  ('both',     'large',  9000),
  ('both',     'van',    10500),
  ('full',     'small',  12000),
  ('full',     'medium', 14000),
  ('full',     'large',  16000),
  ('full',     'van',    18000)
) as p (service_key, tier_key, amount_cents)
join service s on s.key = p.service_key
join vehicle_size_tier t on t.key = p.tier_key;

-- Add-ons — PLACEHOLDER amounts ---------------------------------------------
insert into add_on (key, name_key, amount_cents, active) values
  ('pet_hair', 'AddOns.pet_hair', 2000, true),
  ('odour',    'AddOns.odour',    2500, true),
  ('leather',  'AddOns.leather',  3000, true),
  ('engine',   'AddOns.engine',   3500, true);

-- Postcode areas — PLACEHOLDER prefixes / travel fees ------------------------
insert into postcode_area (prefix, travel_fee_cents, in_area) values
  ('1000', 0,    true),   -- placeholder: base area, no travel fee
  ('9000', 1500, true),   -- placeholder: outer area, travel fee applies
  ('2000', 0,    false);  -- placeholder: out of service area

-- Open slots — generated relative to now so the date/time step always has
-- upcoming availability in dev. Each appointment is a 2-hour slot with a
-- 1-hour travel gap before the next: starts at 10, 13, 16, 19 in BRUSSELS
-- local wall-clock (10-12, 13-15, 16-18, 19-21), stored as UTC. PLACEHOLDER
-- schedule; the owner defines real slots (B6). (ADR-015)
insert into slot (start_at, end_at, status)
select
  start_local at time zone 'Europe/Brussels' as start_at,
  (start_local + interval '2 hours') at time zone 'Europe/Brussels' as end_at,
  'open'
from (
  select
    date_trunc('day', now() at time zone 'Europe/Brussels')
      + make_interval(days => d, hours => h) as start_local
  from generate_series(1, 7) as d
  cross join (values (10), (13), (16), (19)) as t (h)
) s
order by start_at;
