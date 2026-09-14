/**
 * Geoapify geocoding — SERVER ONLY. The API key (`GEOAPIFY_API_KEY`) is read
 * here and never returned to the caller, so it can't reach the browser. Used by
 * the booking flow's address autocomplete: results are constrained to Belgium
 * and post-filtered to the customer's postcode, and capped to a handful.
 */
export interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
  formatted: string;
}

const AUTOCOMPLETE_URL = 'https://api.geoapify.com/v1/geocode/autocomplete';
const MAX_SUGGESTIONS = 5;

export async function autocompleteAddress(opts: {
  query: string;
  postcode: string;
}): Promise<AddressSuggestion[]> {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    text: opts.query,
    filter: 'countrycode:be', // Belgium only
    lang: 'en',
    limit: '15',
    format: 'geojson',
    apiKey: key,
  });

  let data: unknown;
  try {
    const res = await fetch(`${AUTOCOMPLETE_URL}?${params.toString()}`);
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }

  const features =
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { features?: unknown }).features)
      ? ((data as { features: unknown[] }).features as Array<{
          properties?: Record<string, unknown>;
        }>)
      : [];

  const out: AddressSuggestion[] = [];
  for (const f of features) {
    const p = f.properties ?? {};
    // Filter to the customer's postcode (Geoapify returns `postcode`).
    if (opts.postcode && p.postcode !== opts.postcode) continue;
    const lat = p.lat;
    const lon = p.lon;
    const formatted = p.formatted;
    if (
      typeof lat !== 'number' ||
      typeof lon !== 'number' ||
      typeof formatted !== 'string'
    ) {
      continue;
    }
    out.push({ label: formatted, lat, lng: lon, formatted });
    if (out.length >= MAX_SUGGESTIONS) break;
  }
  return out;
}
