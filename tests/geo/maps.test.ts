import { describe, it, expect } from 'vitest';
import { googleMapsUrl, hasCoords } from '@/lib/geo/maps';

describe('googleMapsUrl', () => {
  it('uses exact coordinates when present', () => {
    expect(
      googleMapsUrl({
        latitude: 50.8467,
        longitude: 4.3517,
        address: 'ignored',
        postcode: '1000',
      }),
    ).toBe('https://www.google.com/maps/search/?api=1&query=50.8467,4.3517');
  });

  it('falls back to the formatted address when coords are absent', () => {
    expect(
      googleMapsUrl({
        latitude: null,
        longitude: null,
        formattedAddress: 'Grote Markt 1, 1000 Brussels',
        address: 'Grote Markt 1',
        postcode: '1000',
      }),
    ).toBe(
      'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent('Grote Markt 1, 1000 Brussels'),
    );
  });

  it('falls back to the text address + postcode when nothing else', () => {
    expect(googleMapsUrl({ address: 'Rue du Test 9', postcode: '1000' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent('Rue du Test 9, 1000'),
    );
  });

  it('hasCoords reflects presence of both numbers', () => {
    expect(hasCoords({ latitude: 1, longitude: 2 })).toBe(true);
    expect(hasCoords({ latitude: null, longitude: 2 })).toBe(false);
    expect(hasCoords({})).toBe(false);
  });
});
