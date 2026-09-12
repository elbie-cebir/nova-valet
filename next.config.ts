import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from 'next';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PGlite ships a wasm build of Postgres; keep it external so Next loads it
  // from node_modules at runtime instead of trying to bundle the wasm.
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
};

export default withNextIntl(nextConfig);
