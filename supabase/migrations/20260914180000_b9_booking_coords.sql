-- B9 — store geocoded coordinates on the booking (from Geoapify address autofill).
--
-- Additive + nullable: existing bookings and manual free-text addresses are
-- unaffected (no coords → the admin map falls back to a text-address Google
-- Maps link). We geocode ONCE at reserve time and never re-call for the map.

alter table booking
  add column latitude double precision,
  add column longitude double precision,
  add column formatted_address text;
