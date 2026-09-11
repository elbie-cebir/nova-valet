-- B1 seed — PLACEHOLDER DATA ONLY.
-- Every amount and postcode below is a placeholder for local development and
-- tests; none are real Nova Valet prices or service areas. Client to confirm
-- real values later. Human-facing strings are i18n KEYS only, never literal
-- copy — the message catalogues resolve them per locale.

-- Services -------------------------------------------------------------------
insert into service (key, name_key, description_key, active) values
  ('exterior_wash', 'service.exterior_wash.name', 'service.exterior_wash.desc', true),
  ('full_valet',    'service.full_valet.name',    'service.full_valet.desc',    true),
  ('interior_detail','service.interior_detail.name','service.interior_detail.desc', true);

-- Vehicle size tiers ---------------------------------------------------------
insert into vehicle_size_tier (key, label_key, sort_order) values
  ('small',  'tier.small.label',  1),
  ('medium', 'tier.medium.label', 2),
  ('large',  'tier.large.label',  3);

-- Price matrix (service x tier) — PLACEHOLDER amounts in cents ---------------
insert into price (service_id, vehicle_size_tier_id, amount_cents, currency)
select s.id, t.id, p.amount_cents, 'EUR'
from (values
  ('exterior_wash',  'small',  4500),
  ('exterior_wash',  'medium', 5500),
  ('exterior_wash',  'large',  6500),
  ('full_valet',     'small',  9500),
  ('full_valet',     'medium', 11500),
  ('full_valet',     'large',  13500),
  ('interior_detail','small',  7500),
  ('interior_detail','medium', 8500),
  ('interior_detail','large',  9500)
) as p (service_key, tier_key, amount_cents)
join service s on s.key = p.service_key
join vehicle_size_tier t on t.key = p.tier_key;

-- Add-ons — PLACEHOLDER amounts ---------------------------------------------
insert into add_on (key, name_key, amount_cents, active) values
  ('pet_hair_removal', 'addon.pet_hair_removal.name', 2000, true),
  ('wax_seal',         'addon.wax_seal.name',         3000, true);

-- Postcode areas — PLACEHOLDER prefixes / travel fees ------------------------
insert into postcode_area (prefix, travel_fee_cents, in_area) values
  ('1000', 0,    true),   -- placeholder: base area, no travel fee
  ('9000', 1500, true),   -- placeholder: outer area, travel fee applies
  ('2000', 0,    false);  -- placeholder: out of service area
