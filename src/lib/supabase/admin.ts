import { createClient } from '@supabase/supabase-js';

/**
 * Privileged, service-role Supabase client — SERVER ONLY. It bypasses RLS, so it
 * must never be imported into a client component or exposed to the browser. Used
 * for owner operations that need elevated access (e.g. Storage uploads for
 * homepage media). Reads `SUPABASE_SERVICE_ROLE_KEY`, which is never public.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const HOMEPAGE_BUCKET = 'homepage';

/**
 * Upload one image to the public `homepage` Storage bucket and return its public
 * CDN URL. Creates the bucket on first use (idempotent). Server-only.
 */
export async function uploadPublicImage(opts: {
  path: string;
  bytes: ArrayBuffer;
  contentType: string;
}): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, reason: 'storage_unconfigured' };
  }

  // Ensure the bucket exists (public). Ignore "already exists".
  await admin.storage
    .createBucket(HOMEPAGE_BUCKET, { public: true })
    .catch(() => undefined);

  const { error } = await admin.storage
    .from(HOMEPAGE_BUCKET)
    .upload(opts.path, opts.bytes, {
      contentType: opts.contentType,
      upsert: true,
    });
  if (error) return { ok: false, reason: 'upload_failed' };

  const { data } = admin.storage.from(HOMEPAGE_BUCKET).getPublicUrl(opts.path);
  return { ok: true, url: data.publicUrl };
}
