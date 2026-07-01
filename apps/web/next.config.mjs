import path from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the shared workspace package from source.
  transpilePackages: ['@cougny/protocol'],
  // Emit a self-contained server bundle for a minimal production Docker image.
  output: 'standalone',
  // In a monorepo, trace workspace files from the repo root.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
};

export default withNextIntl(nextConfig);
