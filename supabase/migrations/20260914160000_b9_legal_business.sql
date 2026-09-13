-- B9 PART E — legal pages (privacy / terms / cookie) + business details.
--
-- Both are single-row tables (boolean PK fixed to true). Legal text is per locale
-- and multi-paragraph (plain text, newlines preserved on render). Seeded with
-- clearly-marked PLACEHOLDERS the owner replaces with real copy; business details
-- likewise. No real legal/VAT values are invented here.

create table legal_content (
  id boolean primary key default true,
  privacy_nl text not null,
  privacy_en text not null,
  privacy_fr text not null,
  terms_nl text not null,
  terms_en text not null,
  terms_fr text not null,
  cookie_nl text not null,
  cookie_en text not null,
  cookie_fr text not null,
  updated_at timestamptz not null default now(),
  constraint legal_single_row check (id)
);

insert into legal_content (
  id,
  privacy_nl, privacy_en, privacy_fr,
  terms_nl, terms_en, terms_fr,
  cookie_nl, cookie_en, cookie_fr
) values (
  true,
  '[Privacybeleid — nog aan te vullen door de eigenaar.]',
  '[Privacy policy — to be provided by the owner.]',
  '[Politique de confidentialité — à compléter par le propriétaire.]',
  '[Algemene voorwaarden — nog aan te vullen door de eigenaar.]',
  '[Terms & conditions — to be provided by the owner.]',
  '[Conditions générales — à compléter par le propriétaire.]',
  'We gebruiken essentiële cookies om deze site te laten werken. [Cookiemelding — nog aan te vullen.]',
  'We use essential cookies to run this site. [Cookie notice — to be provided.]',
  'Nous utilisons des cookies essentiels pour faire fonctionner ce site. [Avis cookies — à compléter.]'
);

create table business_details (
  id boolean primary key default true,
  legal_name text not null,
  address text not null,
  vat_number text not null,
  contact_email text not null,
  contact_phone text not null,
  updated_at timestamptz not null default now(),
  constraint business_single_row check (id)
);

insert into business_details (
  id, legal_name, address, vat_number, contact_email, contact_phone
) values (
  true, '[Legal name]', '[Address]', '[VAT number]', '[email]', '[phone]'
);
