import type { Queryable } from './types';

/** Localized homepage content for the customer home page. */
export interface HomepageContent {
  heroTitle: string;
  heroSub: string;
  areaSnippet: string;
  beforeImageUrl: string | null;
  afterImageUrl: string | null;
}

/** Full per-locale homepage content for the admin editor. */
export interface HomepageAdmin {
  heroTitle: { nl: string; en: string; fr: string };
  heroSub: { nl: string; en: string; fr: string };
  areaSnippet: { nl: string; en: string; fr: string };
  beforeImageUrl: string | null;
  afterImageUrl: string | null;
}

function pick(loc: string, nl: string, en: string, fr: string): string {
  return loc === 'en' ? en : loc === 'fr' ? fr : nl;
}

interface Row {
  hero_title_nl: string;
  hero_title_en: string;
  hero_title_fr: string;
  hero_sub_nl: string;
  hero_sub_en: string;
  hero_sub_fr: string;
  area_snippet_nl: string;
  area_snippet_en: string;
  area_snippet_fr: string;
  before_image_url: string | null;
  after_image_url: string | null;
}

async function readRow(db: Queryable): Promise<Row | null> {
  const { rows } = await db.query<Row>(
    `select hero_title_nl, hero_title_en, hero_title_fr,
            hero_sub_nl, hero_sub_en, hero_sub_fr,
            area_snippet_nl, area_snippet_en, area_snippet_fr,
            before_image_url, after_image_url
     from homepage_content where id = true`,
  );
  return rows[0] ?? null;
}

export async function getHomepageContent(
  db: Queryable,
  locale: string,
): Promise<HomepageContent | null> {
  const r = await readRow(db);
  if (!r) return null;
  return {
    heroTitle: pick(locale, r.hero_title_nl, r.hero_title_en, r.hero_title_fr),
    heroSub: pick(locale, r.hero_sub_nl, r.hero_sub_en, r.hero_sub_fr),
    areaSnippet: pick(
      locale,
      r.area_snippet_nl,
      r.area_snippet_en,
      r.area_snippet_fr,
    ),
    beforeImageUrl: r.before_image_url,
    afterImageUrl: r.after_image_url,
  };
}

export async function getHomepageAdmin(
  db: Queryable,
): Promise<HomepageAdmin | null> {
  const r = await readRow(db);
  if (!r) return null;
  return {
    heroTitle: {
      nl: r.hero_title_nl,
      en: r.hero_title_en,
      fr: r.hero_title_fr,
    },
    heroSub: { nl: r.hero_sub_nl, en: r.hero_sub_en, fr: r.hero_sub_fr },
    areaSnippet: {
      nl: r.area_snippet_nl,
      en: r.area_snippet_en,
      fr: r.area_snippet_fr,
    },
    beforeImageUrl: r.before_image_url,
    afterImageUrl: r.after_image_url,
  };
}

interface LocaleText {
  nl: string;
  en: string;
  fr: string;
}

export async function updateHomepageText(
  db: Queryable,
  v: { heroTitle: LocaleText; heroSub: LocaleText; areaSnippet: LocaleText },
): Promise<void> {
  await db.query(
    `update homepage_content set
       hero_title_nl=$1, hero_title_en=$2, hero_title_fr=$3,
       hero_sub_nl=$4, hero_sub_en=$5, hero_sub_fr=$6,
       area_snippet_nl=$7, area_snippet_en=$8, area_snippet_fr=$9,
       updated_at=now()
     where id = true`,
    [
      v.heroTitle.nl,
      v.heroTitle.en,
      v.heroTitle.fr,
      v.heroSub.nl,
      v.heroSub.en,
      v.heroSub.fr,
      v.areaSnippet.nl,
      v.areaSnippet.en,
      v.areaSnippet.fr,
    ],
  );
}

export async function setHomeImageUrl(
  db: Queryable,
  field: 'before' | 'after',
  url: string,
): Promise<void> {
  const col = field === 'before' ? 'before_image_url' : 'after_image_url';
  await db.query(
    `update homepage_content set ${col} = $1, updated_at = now() where id = true`,
    [url],
  );
}
