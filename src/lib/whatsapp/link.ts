/**
 * Reduce a human-entered phone number to the digits `wa.me` expects: an
 * international number with no `+`, spaces, or punctuation. Returns '' if there
 * are no digits at all.
 */
export function normalizeWaNumber(phone: string): string {
  return (phone ?? '').replace(/\D/g, '');
}

/**
 * Build a `wa.me` deep link that opens WhatsApp to `toPhone` with `body`
 * pre-filled. Returns null when the number has no digits (nothing to open).
 */
export function buildWaLink(msg: {
  toPhone: string;
  body: string;
}): string | null {
  const digits = normalizeWaNumber(msg.toPhone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg.body)}`;
}
