'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { addressSuggestAction } from '@/app/[locale]/book/actions';
import type { AddressSuggestion } from '@/lib/geo/geoapify';

/**
 * GPS-style address autocomplete for the booking flow. Calls are minimized:
 * nothing fires until a postcode is set and ≥3 chars are typed, and each keypress
 * is DEBOUNCED (300ms). The lookup goes through a server action (key stays
 * server-side). Picking a suggestion fills the text AND lifts the coordinates up
 * via `onSelect`; typing manually calls `onChange` only (parent clears coords).
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  postcode,
  placeholder,
  style,
}: {
  value: string;
  onChange: (text: string) => void;
  onSelect: (s: AddressSuggestion) => void;
  postcode: string;
  placeholder?: string;
  style?: CSSProperties;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  // The value we just selected — used to suppress the refetch it would trigger.
  const selectedRef = useRef<string | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (!postcode || q.length < 3 || selectedRef.current === value) {
      setSuggestions([]);
      return;
    }
    const id = setTimeout(async () => {
      const res = await addressSuggestAction({ query: q, postcode });
      setSuggestions(res.suggestions);
      setOpen(res.suggestions.length > 0);
    }, 300);
    return () => clearTimeout(id);
  }, [value, postcode]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => {
          selectedRef.current = null;
          onChange(e.target.value);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        autoComplete="off"
        style={style}
      />
      {open && suggestions.length > 0 && (
        <ul
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 20,
            margin: 0,
            padding: 4,
            listStyle: 'none',
            borderRadius: 12,
            background: 'var(--nv-bg-page)',
            border: '1px solid var(--nv-border-strong)',
            boxShadow: '0 20px 50px -20px rgba(0,0,0,.8)',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, i) => (
            <li key={`${s.lat},${s.lng},${i}`}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // fire before input blur
                  selectedRef.current = s.label;
                  onSelect(s);
                  setSuggestions([]);
                  setOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: 0,
                  background: 'transparent',
                  color: 'var(--nv-ink)',
                  fontSize: 14,
                  lineHeight: 1.35,
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
