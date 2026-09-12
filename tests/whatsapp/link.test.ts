import { describe, it, expect } from 'vitest';
import { buildWaLink, normalizeWaNumber } from '@/lib/whatsapp';
import en from '../../messages/en.json';
import nl from '../../messages/nl.json';
import fr from '../../messages/fr.json';

describe('wa.me link builder', () => {
  it('normalizes a human number to digits only', () => {
    expect(normalizeWaNumber('+32 470 12 34 56')).toBe('32470123456');
    expect(normalizeWaNumber('0470-12-34-56')).toBe('0470123456');
    expect(normalizeWaNumber('')).toBe('');
  });

  it('builds a wa.me deep link with a URL-encoded body', () => {
    const link = buildWaLink({
      toPhone: '+32 470 12 34 56',
      body: 'Hi Jan & co',
    });
    expect(link).toBe('https://wa.me/32470123456?text=Hi%20Jan%20%26%20co');
  });

  it('returns null when there is no number to open', () => {
    expect(buildWaLink({ toPhone: 'no-digits', body: 'x' })).toBeNull();
  });
});

describe('owner-tap WhatsApp message is localized + carries booking context', () => {
  const catalogs = { en, nl, fr } as Record<string, Record<string, unknown>>;
  const vars = {
    name: 'Jan Peeters',
    service: 'Full detailing',
    when: 'Sun 13 Sept 13:00',
    reference: 'NV-GTRJ3J',
  };

  function interpolate(template: string): string {
    return template.replace(/\{(\w+)\}/g, (_, k: string) =>
      k in vars ? (vars as Record<string, string>)[k] : `{${k}}`,
    );
  }

  const rendered: Record<string, string> = {};

  for (const locale of ['en', 'nl', 'fr']) {
    it(`[${locale}] template exposes every booking placeholder`, () => {
      const wa = catalogs[locale].Wa as Record<string, string>;
      expect(wa?.message).toBeTruthy();
      for (const key of ['name', 'service', 'when', 'reference']) {
        expect(wa.message).toContain(`{${key}}`);
      }
      const out = interpolate(wa.message);
      rendered[locale] = out;
      // The concrete booking context is present in the final body.
      expect(out).toContain(vars.name);
      expect(out).toContain(vars.service);
      expect(out).toContain(vars.when);
      expect(out).toContain(vars.reference);
      // No leftover placeholders.
      expect(out).not.toMatch(/\{\w+\}/);
    });
  }

  it('the three locales are genuinely different copy', () => {
    expect(rendered.en).not.toBe(rendered.nl);
    expect(rendered.en).not.toBe(rendered.fr);
    expect(rendered.nl).not.toBe(rendered.fr);
  });
});
