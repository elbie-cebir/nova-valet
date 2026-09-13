import type { Queryable } from './types';

/** Legal copy for one locale (multi-paragraph plain text). */
export interface LegalContent {
  privacy: string;
  terms: string;
  cookie: string;
}

export interface LegalAdmin {
  privacy: { nl: string; en: string; fr: string };
  terms: { nl: string; en: string; fr: string };
  cookie: { nl: string; en: string; fr: string };
}

function pick(loc: string, nl: string, en: string, fr: string): string {
  return loc === 'en' ? en : loc === 'fr' ? fr : nl;
}

interface Row {
  privacy_nl: string;
  privacy_en: string;
  privacy_fr: string;
  terms_nl: string;
  terms_en: string;
  terms_fr: string;
  cookie_nl: string;
  cookie_en: string;
  cookie_fr: string;
}

async function readRow(db: Queryable): Promise<Row | null> {
  const { rows } = await db.query<Row>(
    `select privacy_nl, privacy_en, privacy_fr,
            terms_nl, terms_en, terms_fr,
            cookie_nl, cookie_en, cookie_fr
     from legal_content where id = true`,
  );
  return rows[0] ?? null;
}

export async function getLegalContent(
  db: Queryable,
  locale: string,
): Promise<LegalContent | null> {
  const r = await readRow(db);
  if (!r) return null;
  return {
    privacy: pick(locale, r.privacy_nl, r.privacy_en, r.privacy_fr),
    terms: pick(locale, r.terms_nl, r.terms_en, r.terms_fr),
    cookie: pick(locale, r.cookie_nl, r.cookie_en, r.cookie_fr),
  };
}

export async function getLegalAdmin(db: Queryable): Promise<LegalAdmin | null> {
  const r = await readRow(db);
  if (!r) return null;
  return {
    privacy: { nl: r.privacy_nl, en: r.privacy_en, fr: r.privacy_fr },
    terms: { nl: r.terms_nl, en: r.terms_en, fr: r.terms_fr },
    cookie: { nl: r.cookie_nl, en: r.cookie_en, fr: r.cookie_fr },
  };
}

interface LocaleText {
  nl: string;
  en: string;
  fr: string;
}

export async function updateLegal(
  db: Queryable,
  v: { privacy: LocaleText; terms: LocaleText; cookie: LocaleText },
): Promise<void> {
  await db.query(
    `update legal_content set
       privacy_nl=$1, privacy_en=$2, privacy_fr=$3,
       terms_nl=$4, terms_en=$5, terms_fr=$6,
       cookie_nl=$7, cookie_en=$8, cookie_fr=$9,
       updated_at=now()
     where id = true`,
    [
      v.privacy.nl,
      v.privacy.en,
      v.privacy.fr,
      v.terms.nl,
      v.terms.en,
      v.terms.fr,
      v.cookie.nl,
      v.cookie.en,
      v.cookie.fr,
    ],
  );
}
