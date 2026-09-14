import { getAuthenticatedOwner } from '@/lib/auth/owner';
import { getDb } from '@/lib/data/db.server';
import { listCustomers, customersToCsv } from '@/lib/data/reporting';

/**
 * Owner-only CSV export of the customer list. Fails closed: a non-owner gets a
 * 404 (same posture as the admin pages). Read-only.
 */
export async function GET(): Promise<Response> {
  const owner = await getAuthenticatedOwner();
  if (!owner) return new Response(null, { status: 404 });

  const db = await getDb();
  const rows = await listCustomers(db, 5000);
  const csv = customersToCsv(rows);

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="nova-valet-customers.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
