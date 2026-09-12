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

describe('owner-tap WhatsApp templates are localized + carry booking context', () => {
  const catalogs = { en, nl, fr } as Record<string, Record<string, unknown>>;
  const vars: Record<string, string> = {
    name: 'Jan Peeters',
    ref: 'NV-GTRJ3J',
    slot: 'Sunday 13 September 13:00',
    addr: 'Rue de la Loi 16, 1000',
    bal: '€115.00',
    service: 'Full detailing · Medium',
    time: '13:00',
  };

  function interpolate(template: string): string {
    return template.replace(/\{(\w+)\}/g, (_, k: string) =>
      k in vars ? vars[k] : `{${k}}`,
    );
  }

  const renderedConfirm: Record<string, string> = {};

  for (const locale of ['en', 'nl', 'fr']) {
    it(`[${locale}] confirmation template carries name, ref, slot, address, balance`, () => {
      const wa = catalogs[locale].Wa as Record<string, string>;
      // All four templates + their chip labels exist.
      for (const k of [
        'tConfirm',
        'tReminder',
        'tBalance',
        'tOnWay',
        'tConfirmLabel',
        'tReminderLabel',
        'tBalanceLabel',
        'tOnWayLabel',
      ]) {
        expect(wa[k]).toBeTruthy();
      }
      for (const key of ['name', 'ref', 'slot', 'addr', 'bal']) {
        expect(wa.tConfirm).toContain(`{${key}}`);
      }
      // The fully-paid confirmation exists and drops the balance line.
      expect(wa.tConfirmPaid).toBeTruthy();
      expect(wa.tConfirmPaid).not.toContain('{bal}');
      expect(interpolate(wa.tConfirmPaid)).not.toMatch(/\{\w+\}/);
      const out = interpolate(wa.tConfirm);
      renderedConfirm[locale] = out;
      expect(out).toContain(vars.name);
      expect(out).toContain(vars.ref);
      expect(out).toContain(vars.slot);
      expect(out).toContain(vars.addr);
      expect(out).toContain(vars.bal);
      expect(out).not.toMatch(/\{\w+\}/);
    });
  }

  it('the three locales are genuinely different copy', () => {
    expect(renderedConfirm.en).not.toBe(renderedConfirm.nl);
    expect(renderedConfirm.en).not.toBe(renderedConfirm.fr);
    expect(renderedConfirm.nl).not.toBe(renderedConfirm.fr);
  });
});
