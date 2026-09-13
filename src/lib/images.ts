/**
 * Image upload validation — shared by the homepage media action and its tests.
 * Kept out of the `'use server'` action module (which may only export async
 * functions).
 */

/** Allowed upload MIME types → file extension. */
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Type must be allowed and size within the cap. */
export function validateImage(
  type: string,
  size: number,
): { ok: true; ext: string } | { ok: false; reason: string } {
  const ext = IMAGE_TYPES[type];
  if (!ext) return { ok: false, reason: 'bad_type' };
  if (size <= 0 || size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: 'too_big' };
  }
  return { ok: true, ext };
}
