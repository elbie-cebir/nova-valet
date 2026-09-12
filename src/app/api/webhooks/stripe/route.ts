import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data/db.server';
import { verifyStripeEvent } from '@/lib/payments/stripe';
import { applyStripeEvent } from '@/lib/payments/webhooks';

// Needs the raw body + Node crypto for signature verification.
export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing signature' }, { status: 400 });
  }

  const rawBody = await req.text();

  let event;
  try {
    // Parse, don't trust: a forged/invalid signature throws → 400.
    event = verifyStripeEvent(rawBody, signature);
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  try {
    const db = await getDb();
    await applyStripeEvent(db, event);
  } catch {
    // A processing error → 500 so Stripe retries (apply is idempotent).
    return NextResponse.json({ error: 'processing error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
