import type { Queryable } from './types';

/**
 * Owner service-area management (B9 PART B). CRUD over `postcode_area` — the
 * prefix table that `getTravelFee` matches against (longest-prefix wins). Rows
 * are safe to hard-delete: bookings snapshot the postcode + travel fee at
 * reserve time and hold no FK to this table. Mutations run only from
 * owner-guarded actions that revalidate the `service-area` cache tag.
 */

export interface PostcodeArea {
  id: string;
  prefix: string;
  travelFeeCents: number;
  inArea: boolean;
}

export async function listPostcodeAreas(
  db: Queryable,
): Promise<PostcodeArea[]> {
  const { rows } = await db.query<{
    id: string;
    prefix: string;
    travel_fee_cents: number;
    in_area: boolean;
  }>(
    `select id, prefix, travel_fee_cents, in_area
     from postcode_area order by prefix asc`,
  );
  return rows.map((r) => ({
    id: r.id,
    prefix: r.prefix,
    travelFeeCents: Number(r.travel_fee_cents),
    inArea: r.in_area,
  }));
}

export async function createPostcodeArea(
  db: Queryable,
  v: { prefix: string; travelFeeCents: number; inArea: boolean },
): Promise<void> {
  await db.query(
    `insert into postcode_area (prefix, travel_fee_cents, in_area)
     values ($1, $2, $3)`,
    [v.prefix, v.travelFeeCents, v.inArea],
  );
}

export async function updatePostcodeArea(
  db: Queryable,
  id: string,
  v: { prefix: string; travelFeeCents: number; inArea: boolean },
): Promise<void> {
  await db.query(
    `update postcode_area set prefix=$2, travel_fee_cents=$3, in_area=$4
     where id=$1`,
    [id, v.prefix, v.travelFeeCents, v.inArea],
  );
}

export async function deletePostcodeArea(
  db: Queryable,
  id: string,
): Promise<void> {
  await db.query(`delete from postcode_area where id=$1`, [id]);
}
