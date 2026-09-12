-- B9 — reminder scheduler. Track when a booking's reminder was sent so the cron
-- can never double-send (this timestamp is the idempotency key). Additive +
-- idempotent, so re-applying to the live Supabase is safe.
alter table booking add column if not exists reminder_sent_at timestamptz;
