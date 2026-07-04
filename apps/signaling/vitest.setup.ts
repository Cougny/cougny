// Test-only environment defaults. `env.ts` validates at first import (and
// exits the process on failure); several modules pull it in transitively via
// the logger, so CI — which has no .env file — needs these before any test
// file loads. Real values (e.g. REDIS_URL for the integration suites) win.
process.env.AUTH_JWT_SECRET ??= 'test-secret-at-least-16-chars';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?schema=public';
