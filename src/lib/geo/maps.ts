/**
 * Build a Google Maps navigation URL for a booking. Prefers stored coordinates
 * (exact pin); falls back to the formatted or text address when a booking has no
 * coords (older/manual). No API key — a plain maps.google.com search link.
 */
export function googleMapsUrl(b: {
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
  address: string;
  postcode: string;
}): string {
  const base = 'https://www.google.com/maps/search/?api=1&query=';
  if (typeof b.latitude === 'number' && typeof b.longitude === 'number') {
    return `${base}${b.latitude},${b.longitude}`;
  }
  const q = b.formattedAddress?.trim() || `${b.address}, ${b.postcode}`;
  return `${base}${encodeURIComponent(q)}`;
}

/** True when a booking has usable coordinates for a map pin. */
export function hasCoords(b: {
  latitude?: number | null;
  longitude?: number | null;
}): boolean {
  return typeof b.latitude === 'number' && typeof b.longitude === 'number';
}
