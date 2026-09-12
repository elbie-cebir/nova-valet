import { NextResponse } from 'next/server';
import { verifyWhatsAppSignature } from '@/lib/whatsapp/signature';
import { parseWhatsAppEvents, dedupeNewIds } from '@/lib/whatsapp/events';

// Needs the raw body + Node crypto for X-Hub signature verification.
export const runtime = 'nodejs';

// Per-process idempotency store (dev). Production hardening: back this with a
// table so redeliveries dedupe across instances.
const seen = new Set<string>();

/**
 * Meta webhook verification handshake: echo `hub.challenge` back ONLY when the
 * verify token matches ours. (Configured by the operator in Meta.)
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge') ?? '';
  if (
    mode === 'subscribe' &&
    token &&
    token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }
  return new Response('forbidden', { status: 403 });
}

/**
 * Inbound events (delivery/read receipts + customer messages). Parse, don't
 * trust: reject any body whose X-Hub-Signature-256 doesn't verify against the
 * app secret. Idempotent on message/status id.
 */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text();
  const signature = req.headers.get('x-hub-signature-256');
  if (
    !verifyWhatsAppSignature(raw, signature, process.env.WHATSAPP_APP_SECRET)
  ) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: unknown = {};
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = {};
  }

  const { messageIds, statusIds } = parseWhatsAppEvents(payload);
  const freshMessages = dedupeNewIds(messageIds, seen);
  const freshStatuses = dedupeNewIds(statusIds, seen);

  // B7: acknowledge + dedupe. Acting on inbound replies / delivery status is
  // future work (would land in a dedicated store).
  if (freshMessages.length > 0 || freshStatuses.length > 0) {
    console.log('[whatsapp:webhook] new events', {
      messages: freshMessages.length,
      statuses: freshStatuses.length,
    });
  }

  return NextResponse.json({ received: true });
}
