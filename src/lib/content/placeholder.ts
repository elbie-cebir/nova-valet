/**
 * Owner-managed content is seeded with clearly-marked `[placeholders]`. Until the
 * owner fills a field, we hide that section (or strip the fragment) so nothing
 * bracketed shows to the public. A value counts as a placeholder if it's empty or
 * contains a `[...]` token.
 */
export function isPlaceholder(s: string | null | undefined): boolean {
  return !s || /\[[^\]]*\]/.test(s);
}

/** Remove `[...]` fragments (and a dangling `·`/space) from otherwise-real copy. */
export function stripPlaceholders(s: string): string {
  return s
    .replace(/\s*·?\s*\[[^\]]*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
