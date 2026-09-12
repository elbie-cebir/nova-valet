import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { SiteHeader } from '@/components/site-header';
import type { ReactNode } from 'react';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata = {
  title: 'Nova Valet',
  description: 'Mobile car valeting booking.',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enable static rendering for this locale.
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body>
        {/* Fonts from the POC. React hoists these <link>s into <head>; if
            offline, the stack falls back to system fonts. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <NextIntlClientProvider>
          <div
            style={{
              minHeight: '100dvh',
              position: 'relative',
              overflowX: 'hidden',
            }}
          >
            {/* atmosphere */}
            <div
              aria-hidden
              style={{
                position: 'fixed',
                inset: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '-20%',
                  left: '-10%',
                  width: '70%',
                  height: '60%',
                  borderRadius: 999,
                  background:
                    'radial-gradient(closest-side,rgba(214,240,77,.18),transparent)',
                  filter: 'blur(50px)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '-10%',
                  right: '-15%',
                  width: '70%',
                  height: '60%',
                  borderRadius: 999,
                  background:
                    'radial-gradient(closest-side,rgba(90,120,255,.14),transparent)',
                  filter: 'blur(60px)',
                }}
              />
            </div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <SiteHeader />
              {children}
            </div>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
