import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify a WhatsApp/Meta webhook `X-Hub-Signature-256` header against the raw
 * request body using the app secret. Parse, don't trust: a missing, malformed,
 * or mismatched signature returns false so the route can reject it. Comparison
 * is constant-time.
 */
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string | undefined,
): boolean {
  if (!signatureHeader || !appSecret) return false;
  if (!signatureHeader.startsWith('sha256=')) return false;

  const expected =
    'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
