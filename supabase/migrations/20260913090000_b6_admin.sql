-- B6 — Owner admin.
-- Adds two things, both idempotent so re-applying to an existing database
-- (the real Supabase Postgres already carries B1..B5) is safe:
--   1. slot.closed  — the owner can CLOSE a bookable slot without deleting it.
--      A closed slot is excluded from customer availability and can be re-opened.
--      Modelled as a boolean (not a new slot_status enum value) on purpose:
--      `alter type ... add value` cannot run inside a transaction block, which
--      the multi-statement migration runner would wrap it in. A column sidesteps
--      that entirely and stays trivially idempotent.
--   2. booking_event — an append-only audit trail. Every owner action that
--      changes a booking's lifecycle (reschedule / cancel / complete) writes a
--      row here, attributed to the acting owner. (Standards: no silent state
--      change — every transition is attributed where an actor exists, recorded.)

alter table slot add column if not exists closed boolean not null default false;

create table if not exists booking_event (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references booking (id) on delete cascade,
  type text not null,
  actor text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists booking_event_booking_idx
  on booking_event (booking_id);
