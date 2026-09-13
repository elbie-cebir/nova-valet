-- B9 PART D — customer testimonials, owner-managed.
--
-- Author display name, free text, and an OPTIONAL 1–5 rating. Reviews are real
-- customer words, so they are not per-locale and NONE are seeded — the section
-- stays empty until the owner adds genuine testimonials.

create table review (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  body text not null,
  rating integer check (rating between 1 and 5),
  published boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index review_published_idx on review (published);
