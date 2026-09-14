import type { Queryable } from './types';

/**
 * Customer testimonials (B9 PART D). Real customer words — not per-locale, none
 * seeded. The customer surface reads only published reviews; the admin reads all.
 * Mutations run from owner-guarded actions that revalidate the `reviews` tag.
 */

export interface Review {
  id: string;
  authorName: string;
  body: string;
  rating: number | null;
  published: boolean;
  sortOrder: number;
}

function toReview(r: {
  id: string;
  author_name: string;
  body: string;
  rating: number | null;
  published: boolean;
  sort_order: number;
}): Review {
  return {
    id: r.id,
    authorName: r.author_name,
    body: r.body,
    rating: r.rating === null ? null : Number(r.rating),
    published: r.published,
    sortOrder: Number(r.sort_order),
  };
}

const COLS = `id, author_name, body, rating, published, sort_order`;

/** Published reviews for the customer trust section (bounded showcase). */
export async function getPublishedReviews(
  db: Queryable,
  limit = 24,
): Promise<Review[]> {
  const { rows } = await db.query<Parameters<typeof toReview>[0]>(
    `select ${COLS} from review
     where published
     order by sort_order asc, created_at desc
     limit $1`,
    [limit],
  );
  return rows.map(toReview);
}

/** Every review for the admin list (paginated). */
export async function listReviewsAdmin(
  db: Queryable,
  page: { limit: number; offset: number } = { limit: 1000, offset: 0 },
): Promise<Review[]> {
  const { rows } = await db.query<Parameters<typeof toReview>[0]>(
    `select ${COLS} from review
     order by sort_order asc, created_at desc
     limit $1 offset $2`,
    [page.limit, page.offset],
  );
  return rows.map(toReview);
}

/** Total review count — for pagination. */
export async function countReviews(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from review`,
  );
  return Number(rows[0]?.n ?? 0);
}

export async function createReview(
  db: Queryable,
  v: {
    authorName: string;
    body: string;
    rating: number | null;
    published: boolean;
    sortOrder: number;
  },
): Promise<void> {
  await db.query(
    `insert into review (author_name, body, rating, published, sort_order)
     values ($1, $2, $3, $4, $5)`,
    [v.authorName, v.body, v.rating, v.published, v.sortOrder],
  );
}

export async function updateReview(
  db: Queryable,
  id: string,
  v: {
    authorName: string;
    body: string;
    rating: number | null;
    published: boolean;
    sortOrder: number;
  },
): Promise<void> {
  await db.query(
    `update review set author_name=$2, body=$3, rating=$4, published=$5, sort_order=$6
     where id=$1`,
    [id, v.authorName, v.body, v.rating, v.published, v.sortOrder],
  );
}

export async function deleteReview(db: Queryable, id: string): Promise<void> {
  await db.query(`delete from review where id=$1`, [id]);
}
