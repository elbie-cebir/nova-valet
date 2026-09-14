import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// book/actions.ts pulls in the content cache at import; passthrough next/cache.
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
}));

import { autocompleteAddress } from '@/lib/geo/geoapify';
import { addressSuggestAction } from '@/app/[locale]/book/actions';

const feat = (
  postcode: string,
  formatted: string,
  lat: number,
  lon: number,
) => ({
  properties: { postcode, formatted, lat, lon },
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.GEOAPIFY_API_KEY = 'test-key-123';
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      features: [
        feat('1000', 'Rue A 1, 1000 Brussels', 50.85, 4.35),
        feat('1000', 'Rue B 2, 1000 Brussels', 50.86, 4.36),
        feat('9000', 'Straat C, 9000 Gent', 51.05, 3.72), // wrong postcode
      ],
    }),
  }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('Geoapify autocomplete (server-side)', () => {
  it('queries Belgium, passes the key server-side, and filters to the postcode', async () => {
    const r = await autocompleteAddress({ query: 'Rue', postcode: '1000' });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('countrycode%3Abe'); // countrycode:be, url-encoded
    expect(url).toContain('apiKey=test-key-123');
    expect(r).toHaveLength(2); // 9000 filtered out
    expect(r[0]).toEqual({
      label: 'Rue A 1, 1000 Brussels',
      lat: 50.85,
      lng: 4.35,
      formatted: 'Rue A 1, 1000 Brussels',
    });
  });

  it('never leaks the API key in the returned payload', async () => {
    const r = await autocompleteAddress({ query: 'Rue', postcode: '1000' });
    expect(JSON.stringify(r)).not.toContain('test-key-123');
  });

  it('caps suggestions at 5', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: Array.from({ length: 9 }, (_, i) =>
          feat('1000', `Addr ${i}`, 50 + i / 100, 4 + i / 100),
        ),
      }),
    });
    const r = await autocompleteAddress({ query: 'Addr', postcode: '1000' });
    expect(r).toHaveLength(5);
  });

  it('returns [] when no key is configured (no call attempted)', async () => {
    delete process.env.GEOAPIFY_API_KEY;
    const r = await autocompleteAddress({ query: 'Rue', postcode: '1000' });
    expect(r).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('addressSuggestAction (min-chars + postcode guard)', () => {
  it('rejects <3 chars or a missing postcode → empty', async () => {
    expect(
      (await addressSuggestAction({ query: 'Ru', postcode: '1000' }))
        .suggestions,
    ).toEqual([]);
    expect(
      (await addressSuggestAction({ query: 'Rue', postcode: '' })).suggestions,
    ).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled(); // guarded before any Geoapify call
  });

  it('returns postcode-filtered suggestions for valid input', async () => {
    const r = await addressSuggestAction({ query: 'Rue', postcode: '1000' });
    expect(r.suggestions).toHaveLength(2);
    expect(r.suggestions.every((s) => !('apiKey' in s))).toBe(true);
  });
});
