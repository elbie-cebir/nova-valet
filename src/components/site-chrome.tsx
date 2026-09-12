'use client';

import { usePathname } from '@/i18n/navigation';
import type { ReactNode } from 'react';

/**
 * The customer top bar is shown on every page EXCEPT the owner admin, which
 * carries its own chrome (sidebar / pill tabs) like the POC. `usePathname`
 * returns the locale-stripped path, so this is one check for all locales.
 */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null;
  return <>{children}</>;
}
