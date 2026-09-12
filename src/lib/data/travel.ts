import type { Queryable } from './types';

export interface TravelFeeResult {
  /** Whether a postcode area matched at all. */
  found: boolean;
  /** Whether the address is inside the service area. */
  inArea: boolean;
  /** Travel fee in cents (0 when unknown or in the base area). */
  feeCents: number;
  /** The matched area prefix, when found. */
  prefix?: string;
}

const OUT_OF_AREA: TravelFeeResult = {
  found: false,
  inArea: false,
  feeCents: 0,
};

/**
 * Look up the travel fee and in/out-of-area flag for a postcode.
 *
 * Matches on the longest `postcode_area.prefix` that the postcode begins with,
 * so both exact codes and broader prefixes work. An unknown postcode fails
 * closed: not found, out of area, no fee.
 */
export async function getTravelFee(
  db: Queryable,
  postcode: string,
): Promise<TravelFeeResult> {
  const normalized = postcode.trim();
  if (!normalized) return OUT_OF_AREA;

  const { rows } = await db.query<{
    prefix: string;
    travel_fee_cents: number;
    in_area: boolean;
  }>(
    `select prefix, travel_fee_cents, in_area
     from postcode_area
     where $1 like prefix || '%'
     order by length(prefix) desc
     limit 1`,
    [normalized],
  );

  const row = rows[0];
  if (!row) return OUT_OF_AREA;

  return {
    found: true,
    inArea: row.in_area,
    feeCents: row.in_area ? Number(row.travel_fee_cents) : 0,
    prefix: row.prefix,
  };
}
