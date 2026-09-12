import { randomBytes } from 'node:crypto';

// Crockford-ish alphabet: no 0/O/1/I/L to keep references easy to read aloud.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * A short, human-readable booking reference, e.g. `NV-7QK4R9`. High-entropy
 * enough for a guest fallback lookup; uniqueness is guaranteed by the DB unique
 * constraint on `booking.reference`, with the caller retrying on collision.
 */
export function generateReference(): string {
  const bytes = randomBytes(6);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `NV-${out}`;
}
