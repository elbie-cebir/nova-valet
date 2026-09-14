import { describe, it, expect } from 'vitest';
import { isPlaceholder, stripPlaceholders } from '@/lib/content/placeholder';

describe('placeholder helpers', () => {
  it('isPlaceholder: empty / null / bracketed = placeholder', () => {
    expect(isPlaceholder(null)).toBe(true);
    expect(isPlaceholder(undefined)).toBe(true);
    expect(isPlaceholder('')).toBe(true);
    expect(isPlaceholder('[region]')).toBe(true);
    expect(isPlaceholder('We drive to [region] and around.')).toBe(true);
    expect(isPlaceholder('We come to Brussels.')).toBe(false);
  });

  it('stripPlaceholders removes bracket fragments + dangling separators', () => {
    expect(stripPlaceholders('Deep clean · polish · [scope to confirm]')).toBe(
      'Deep clean · polish',
    );
    expect(stripPlaceholders('[Legal name]')).toBe('');
    expect(stripPlaceholders('Hand wash · wheels')).toBe('Hand wash · wheels');
  });
});
