'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap } from 'leaflet';

/**
 * Small OpenStreetMap (Leaflet) map pinned at a booking's stored coordinates.
 * No API key, no tile key. Leaflet is imported lazily inside the effect so it
 * never runs during SSR (it touches `window`). Rendered only when the booking
 * has coordinates; a lime pin (divIcon) avoids Leaflet's bundled marker images.
 */
export function BookingMap({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: LeafletMap | undefined;
    let cancelled = false;
    (async () => {
      const L = await import('leaflet');
      const el = ref.current as
        (HTMLDivElement & { _leaflet_id?: number }) | null;
      if (cancelled || !el || el._leaflet_id) return;
      map = L.map(el, { scrollWheelZoom: false }).setView([lat, lng], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(map);
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:16px;height:16px;border-radius:50%;background:#D6F04D;border:3px solid #0B0C0A;box-shadow:0 0 0 2px #D6F04D"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      L.marker([lat, lng], { icon }).addTo(map);
    })();
    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [lat, lng]);

  return (
    <div
      ref={ref}
      style={{
        height: 220,
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid var(--nv-border)',
      }}
    />
  );
}
