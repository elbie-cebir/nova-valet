-- B1 — Data layer for Nova Valet.
-- Money is integer cents; times are timestamptz; PKs are uuid.
-- One active booking per slot is enforced at the DB, not in app code.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type slot_status as enum ('open', 'held', 'booked');
create type booking_status as enum (
  'pending_deposit',
  'confirmed',
  'completed',
  'cancelled',
  'expired'
);
create type payment_kind as enum ('deposit', 'balance');
create type payment_provider as enum ('mollie', 'stripe');
create type payment_method as enum ('bancontact', 'card');
create type token_kind as enum ('magic_link', 'qr_booking');

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table service (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name_key text not null,
  description_key text not null,
  active boolean not null default true
);

create table vehicle_size_tier (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label_key text not null,
  sort_order integer not null
);

create table price (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references service (id),
  vehicle_size_tier_id uuid not null references vehicle_size_tier (id),
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null default 'EUR',
  unique (service_id, vehicle_size_tier_id)
);

create table add_on (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name_key text not null,
  amount_cents integer not null check (amount_cents >= 0),
  active boolean not null default true
);

create table postcode_area (
  id uuid primary key default gen_random_uuid(),
  prefix text unique not null,
  travel_fee_cents integer not null check (travel_fee_cents >= 0),
  in_area boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Slot + booking (circular FK: slot.booking_id <-> booking.slot_id)
-- The slot.booking_id FK is added after `booking` exists.
-- ---------------------------------------------------------------------------
create table slot (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  end_at timestamptz not null,
  status slot_status not null default 'open',
  held_until timestamptz,
  booking_id uuid,
  check (end_at > start_at)
);

create table booking (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  status booking_status not null default 'pending_deposit',
  service_id uuid not null references service (id),
  vehicle_size_tier_id uuid not null references vehicle_size_tier (id),
  slot_id uuid not null references slot (id),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  address text not null,
  postcode text not null,
  travel_fee_cents integer not null default 0 check (travel_fee_cents >= 0),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  deposit_cents integer not null check (deposit_cents >= 0),
  deposit_paid_at timestamptz,
  balance_cents integer not null check (balance_cents >= 0),
  balance_paid_at timestamptz,
  locale text not null,
  created_at timestamptz not null default now()
);

alter table slot
  add constraint slot_booking_id_fkey
  foreign key (booking_id) references booking (id);

create table booking_add_on (
  booking_id uuid not null references booking (id) on delete cascade,
  add_on_id uuid not null references add_on (id),
  amount_cents integer not null check (amount_cents >= 0),
  primary key (booking_id, add_on_id)
);

-- ---------------------------------------------------------------------------
-- Payments (multi-provider) + guest tokens
-- ---------------------------------------------------------------------------
create table payment (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references booking (id),
  kind payment_kind not null,
  provider payment_provider not null,
  provider_payment_id text,
  method payment_method not null,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null,
  created_at timestamptz not null default now()
);

create table booking_token (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references booking (id) on delete cascade,
  token_hash text unique not null,
  kind token_kind not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

-- ---------------------------------------------------------------------------
-- DB-level invariant: NO DOUBLE-BOOKING.
-- At most one *active* booking may point at a given slot. Terminal bookings
-- (cancelled/expired) are excluded, so a released slot can be rebooked.
-- This is the load-bearing guarantee — it makes double-booking impossible at
-- the database, not merely in application code.
-- ---------------------------------------------------------------------------
create unique index booking_one_active_per_slot
  on booking (slot_id)
  where status in ('pending_deposit', 'confirmed', 'completed');

-- ---------------------------------------------------------------------------
-- Indexes for the columns we filter / join on.
-- ---------------------------------------------------------------------------
create index slot_start_at_idx on slot (start_at);
create index slot_status_idx on slot (status);
create index price_service_idx on price (service_id);
create index price_tier_idx on price (vehicle_size_tier_id);
create index booking_slot_idx on booking (slot_id);
create index booking_status_idx on booking (status);
create index payment_booking_idx on payment (booking_id);
create index booking_add_on_add_on_idx on booking_add_on (add_on_id);
create index booking_token_booking_idx on booking_token (booking_id);
