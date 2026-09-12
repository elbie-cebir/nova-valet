-- Store the provider's hosted-checkout URL on the payment so an in-flight
-- checkout can be REUSED instead of creating a second one (double-payment
-- guard). Idempotent so re-applying to an existing DB is safe.
alter table payment add column if not exists checkout_url text;
