-- B9 PART C — owner-editable homepage content + before/after media.
--
-- Single-row table (id is a boolean PK fixed to true, so there is exactly one
-- row to upsert). Hero headline/message + the service-area snippet are per
-- locale; before/after image URLs point at Supabase Storage public objects
-- (null until the owner uploads — the home page shows a placeholder meanwhile).
-- Seeded with the current copy so nothing changes visually until edited.

create table homepage_content (
  id boolean primary key default true,
  hero_title_nl text not null,
  hero_title_en text not null,
  hero_title_fr text not null,
  hero_sub_nl text not null,
  hero_sub_en text not null,
  hero_sub_fr text not null,
  area_snippet_nl text not null,
  area_snippet_en text not null,
  area_snippet_fr text not null,
  before_image_url text,
  after_image_url text,
  updated_at timestamptz not null default now(),
  constraint homepage_single_row check (id)
);

insert into homepage_content (
  id,
  hero_title_nl, hero_title_en, hero_title_fr,
  hero_sub_nl, hero_sub_en, hero_sub_fr,
  area_snippet_nl, area_snippet_en, area_snippet_fr
) values (
  true,
  'Uw auto, onberispelijk. Aan uw deur.',
  'Your car, immaculate. At your door.',
  'Votre voiture, impeccable. Devant chez vous.',
  'Kies een tijdslot van 2 uur, betaal een klein voorschot om het vast te leggen en betaal het saldo online. Bij u thuis of op het werk.',
  'Book a 2-hour slot, secure it with a small deposit and pay the balance online. At your home or workplace.',
  'Réservez un créneau de 2 heures, bloquez-le avec un petit acompte et payez le solde en ligne. À domicile ou au travail.',
  'Wij rijden naar [regio] en omstreken. Verplaatsingskost per postcode.',
  'We drive to [region] and around. Travel fee shown by postcode.',
  'Nous nous déplaçons à [région] et alentours. Frais de déplacement par code postal.'
);
