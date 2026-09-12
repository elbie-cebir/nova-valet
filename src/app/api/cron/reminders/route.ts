import { NextResponse } from 'next/server';
import { getDb } from '@/lib/data/db.server';
import { runReminderSweep } from '@/lib/notifications/reminders';

export const runtime = 'nodejs';

/**
 * Vercel Cron injects `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET
 * env var is set. Fail closed: if the secret is unset or the header doesn't
 * match, reject — the sweep never runs for an unauthenticated caller.
 */
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: Request): Promise<Response> {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = await getDb();
  const result = await runReminderSweep(db);
  return NextResponse.json({ ok: true, ...result });
}
