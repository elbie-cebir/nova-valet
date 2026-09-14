-- B9 — customer "rate your service" after full payment.
--
-- Link a review to the booking it came from so a customer can submit at most one
-- (partial unique index; owner/manual reviews keep booking_id NULL). Customer
-- submissions are created unpublished and appear in the owner's Reviews admin for
-- approval before they show on the public site.

alter table review add column booking_id uuid references booking (id);

create unique index review_booking_unique
  on review (booking_id)
  where booking_id is not null;
