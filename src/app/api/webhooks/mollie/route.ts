import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data/db.server';
import { mollieGateway } from '@/lib/payments/mollie';
import { applyMollieNotify } from '@/lib/payments/webhooks';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  // Mollie posts application/x-www-form-urlencoded with just `id=tr_...`.
  const body = await req.text();
  const id = new URLSearchParams(body).get('id');
  if (!id) {
    return NextResponse.json({ error: 'missing id' }, { status: 400 });
  }

  try {
    const db = await getDb();
    // Status is fetched from Mollie inside applyMollieNotify — never trusted here.
    await applyMollieNotify(db, mollieGateway, id);
  } catch {
    // Non-2xx makes Mollie retry; the apply is idempotent.
    return NextResponse.json({ error: 'processing error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
