-- B9 PART A — catalog content as per-locale DB fields + editable deposit setting.
--
-- Catalog names/descriptions were i18n KEYS resolved by next-intl. The owner now
-- edits them in admin, so they become per-locale columns on the catalog tables.
-- We add the columns nullable, backfill EXISTING rows (production) with the exact
-- current translations (so nothing changes visually), enforce NOT NULL, then drop
-- the old *_key columns. Fresh DBs get these values from the updated seed.

-- ── service: name + description per locale ──────────────────────────────────
alter table service
  add column name_nl text, add column name_en text, add column name_fr text,
  add column desc_nl text, add column desc_en text, add column desc_fr text;

update service set
  name_nl='Enkel interieur', name_en='Interior only', name_fr='Intérieur seul',
  desc_nl='Stofzuigen · zetels & bekleding · dashboard · binnenruiten',
  desc_en='Vacuum · seats & upholstery · dashboard · interior glass',
  desc_fr='Aspiration · sièges & tissus · tableau de bord · vitres intérieures'
  where key='interior';
update service set
  name_nl='Enkel exterieur', name_en='Exterior only', name_fr='Extérieur seul',
  desc_nl='Handwas · velgen · buitenruiten · bandenglans',
  desc_en='Hand wash · wheels · exterior glass · tyre dressing',
  desc_fr='Lavage à la main · jantes · vitres extérieures · brillant pneus'
  where key='exterior';
update service set
  name_nl='Interieur + exterieur', name_en='Interior + exterior', name_fr='Intérieur + extérieur',
  desc_nl='Alles uit beide pakketten, in één bezoek.',
  desc_en='Everything in both packages, one visit.',
  desc_fr='Tout des deux formules, en une visite.'
  where key='both';
update service set
  name_nl='Volledige detailing', name_en='Full detailing', name_fr='Detailing complet',
  desc_nl='Dieptereiniging · lakdecontaminatie · polish · bescherming · [scope te bevestigen]',
  desc_en='Deep clean · paint decontamination · polish · protection · [scope to confirm]',
  desc_fr='Nettoyage en profondeur · décontamination · polish · protection · [périmètre à confirmer]'
  where key='full';

alter table service
  alter column name_nl set not null, alter column name_en set not null, alter column name_fr set not null,
  alter column desc_nl set not null, alter column desc_en set not null, alter column desc_fr set not null;
alter table service drop column name_key, drop column description_key;

-- ── vehicle_size_tier: label + size description per locale ───────────────────
alter table vehicle_size_tier
  add column label_nl text, add column label_en text, add column label_fr text,
  add column desc_nl text, add column desc_en text, add column desc_fr text;

update vehicle_size_tier set label_nl='Klein', label_en='Small', label_fr='Petite',
  desc_nl='stadswagen', desc_en='city car', desc_fr='citadine' where key='small';
update vehicle_size_tier set label_nl='Middel', label_en='Medium', label_fr='Moyenne',
  desc_nl='hatchback / sedan', desc_en='hatchback / sedan', desc_fr='compacte / berline' where key='medium';
update vehicle_size_tier set label_nl='Groot', label_en='Large', label_fr='Grande',
  desc_nl='SUV / break', desc_en='SUV / estate', desc_fr='SUV / break' where key='large';
update vehicle_size_tier set label_nl='Bestelwagen', label_en='Van', label_fr='Utilitaire',
  desc_nl='MPV / bestelwagen', desc_en='MPV / van', desc_fr='monospace / utilitaire' where key='van';

alter table vehicle_size_tier
  alter column label_nl set not null, alter column label_en set not null, alter column label_fr set not null,
  alter column desc_nl set not null, alter column desc_en set not null, alter column desc_fr set not null;
alter table vehicle_size_tier drop column label_key;

-- ── add_on: name per locale ─────────────────────────────────────────────────
alter table add_on
  add column name_nl text, add column name_en text, add column name_fr text;

update add_on set name_nl='Dierenhaar verwijderen', name_en='Pet hair removal', name_fr='Poils d’animaux' where key='pet_hair';
update add_on set name_nl='Geurbehandeling', name_en='Odour treatment', name_fr='Traitement des odeurs' where key='odour';
update add_on set name_nl='Lederverzorging', name_en='Leather conditioning', name_fr='Soin du cuir' where key='leather';
update add_on set name_nl='Motorruimte reinigen', name_en='Engine bay clean', name_fr='Nettoyage moteur' where key='engine';

alter table add_on
  alter column name_nl set not null, alter column name_en set not null, alter column name_fr set not null;
alter table add_on drop column name_key;

-- ── setting: editable key/value business settings (deposit lives here now) ───
create table setting (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into setting (key, value) values ('deposit_cents', '2500');
