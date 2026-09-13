'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/**
 * Reusable slide-out drawer. A dimmed backdrop covers the page and a panel
 * slides in from `side`; the page stays visible behind it (not a full-screen
 * takeover). Portalled to <body> to escape sticky-header stacking contexts.
 * Closes on backdrop tap or Escape, and locks body scroll while open.
 *
 * Copy-free by design: labels come from the caller, so this stays out of the
 * i18n gate.
 */
export function Drawer({
  open,
  onClose,
  side = 'right',
  width = 320,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  side?: 'left' | 'right';
  width?: number;
  children: ReactNode;
  label?: string;
}) {
  const [mounted, setMounted] = useState(false);
  // `render` keeps the drawer in the tree through its exit animation;
  // `visible` drives the enter/exit transition one frame after mount.
  const [render, setRender] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setRender(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = setTimeout(() => setRender(false), 260);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!render) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [render, onClose]);

  if (!mounted || !render) return null;

  const hidden = side === 'right' ? 'translateX(100%)' : 'translateX(-100%)';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={label}>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(0,0,0,.55)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity .26s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 0,
          bottom: 0,
          [side]: 0,
          zIndex: 61,
          width: `min(86vw, ${width}px)`,
          background: 'var(--nv-bg-page)',
          [side === 'right' ? 'borderLeft' : 'borderRight']:
            '1px solid var(--nv-border)',
          boxShadow:
            side === 'right'
              ? '-24px 0 60px -20px rgba(0,0,0,.7)'
              : '24px 0 60px -20px rgba(0,0,0,.7)',
          transform: visible ? 'translateX(0)' : hidden,
          transition: 'transform .26s cubic-bezier(.4,0,.2,1)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** A round icon button that toggles a drawer (hamburger ↔ close). */
export function DrawerToggle({
  open,
  onClick,
  label,
}: {
  open: boolean;
  onClick: () => void;
  label: string;
}) {
  const bar = {
    position: 'absolute' as const,
    width: 18,
    height: 2,
    borderRadius: 2,
    background: 'var(--nv-ink)',
    transition: 'transform .2s ease, opacity .2s ease',
  };
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={open}
      onClick={onClick}
      style={{
        position: 'relative',
        width: 42,
        height: 42,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--nv-border-strong)',
        borderRadius: 12,
        background: 'var(--nv-surface-2)',
        flex: '0 0 auto',
      }}
    >
      <span
        style={{
          ...bar,
          transform: open ? 'rotate(45deg)' : 'translateY(-6px)',
        }}
      />
      <span style={{ ...bar, opacity: open ? 0 : 1 }} />
      <span
        style={{
          ...bar,
          transform: open ? 'rotate(-45deg)' : 'translateY(6px)',
        }}
      />
    </button>
  );
}
