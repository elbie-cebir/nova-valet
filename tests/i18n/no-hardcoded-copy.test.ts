import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Locale grep: the B2 screens must not carry hardcoded display copy — every
 * user-visible string comes from next-intl `t()`. This scans each file for raw
 * JSX text nodes (alphabetic runs sitting directly between `>` and `<`, i.e.
 * not inside a `{...}` expression) and fails if any survive.
 *
 * Allowlist: the product wordmark, a proper noun deliberately not localized.
 */
const ROOT = process.cwd();
const FILES = [
  'src/app/[locale]/page.tsx',
  'src/app/[locale]/services/page.tsx',
  'src/app/[locale]/prices/page.tsx',
  'src/components/site-header.tsx',
  'src/components/mobile-menu.tsx',
  'src/components/locale-switcher.tsx',
  'src/components/booking/booking-flow.tsx',
  'src/components/booking/payment-picker.tsx',
  'src/components/booking/find-form.tsx',
  'src/components/booking/guest-actions.tsx',
  'src/components/booking/rate-service.tsx',
  'src/components/booking/address-autocomplete.tsx',
  'src/app/[locale]/book/page.tsx',
  'src/app/[locale]/book/pending/[reference]/page.tsx',
  'src/app/[locale]/booking/[token]/page.tsx',
  'src/app/[locale]/find/page.tsx',
  'src/app/[locale]/admin/login/page.tsx',
  'src/app/[locale]/admin/page.tsx',
  'src/app/[locale]/admin/slots/page.tsx',
  'src/app/[locale]/admin/bookings/[reference]/page.tsx',
  'src/components/admin/login-form.tsx',
  'src/components/admin/admin-shell.tsx',
  'src/components/admin/admin-mobile-bar.tsx',
  'src/components/admin/catalog-editor.tsx',
  'src/components/admin/booking-map.tsx',
  'src/components/admin/area-editor.tsx',
  'src/components/admin/homepage-editor.tsx',
  'src/components/admin/reviews-editor.tsx',
  'src/components/admin/legal-editor.tsx',
  'src/components/legal-view.tsx',
  'src/components/cookie-banner.tsx',
  'src/app/[locale]/privacy/page.tsx',
  'src/app/[locale]/terms/page.tsx',
  'src/app/[locale]/admin/payments/page.tsx',
  'src/app/[locale]/admin/customers/page.tsx',
  'src/components/admin/booking-actions.tsx',
  'src/components/admin/slot-week-manager.tsx',
  'src/components/admin/wa-composer.tsx',
];

// Brand/proper nouns + universal abbreviations that are intentionally not localized.
const ALLOWLIST = new Set(['Nova&nbsp;Valet', 'Bancontact', 'WA', 'Stripe']);

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|[^:])\/\/.*$/gm, '$1'); // line comments (leave URLs' `://`)
}

function rawTextNodes(src: string): string[] {
  const clean = stripComments(src);
  // Text between a tag close `>` and the next tag open `<`, containing letters.
  // The excluded char class drops `{}` (so `{t(...)}` expressions don't count)
  // and code punctuation `:;=()` (so TS generics like `Promise<{x: string}>`
  // and arrow fns `() =>` between angle brackets aren't mistaken for copy).
  // The `(?<!=)` lookbehind ignores the `>` in an arrow `=>` (so a return type
  // like `=> Promise<T>` isn't read as JSX text); real JSX `>` is never after `=`.
  const re = /(?<!=)>([^<>{}:;=()]*[A-Za-z]{2,}[^<>{}:;=()]*)</g;
  const hits: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const text = m[1].trim();
    if (text && !ALLOWLIST.has(text)) hits.push(text);
  }
  return hits;
}

describe('B2 screens have no hardcoded display copy', () => {
  for (const rel of FILES) {
    it(`${rel} routes all copy through i18n`, () => {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      expect(rawTextNodes(src)).toEqual([]);
    });
  }
});
