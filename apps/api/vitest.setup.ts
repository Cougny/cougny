// The environment every API test runs against.
//
// `env.ts` loads `apps/api/.env` at first import, and that file is a
// developer's own — pulled from the secret manager, full of real values. A test
// that reads configuration would otherwise assert against whatever happens to
// be in it: configured OAuth providers, a live Redis, a real SMTP host. CI has
// no `.env` at all, so the same test would mean two different things in two
// places. Every variable the API reads is pinned here instead.
//
// `dotenv` never overwrites a variable that is already set, so assigning these
// before any test file loads is enough to shut `.env` out. Setup files run
// ahead of the module graph, which is why this cannot live in a `beforeAll`.
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  API_HOST: '0.0.0.0',
  API_PORT: '4000',
  AUTH_JWT_SECRET: 'test-secret-at-least-16-chars',

  STUN_URL: 'stun:localhost:3478',
  TURN_URL: 'turn:localhost:3478',
  TURN_STATIC_AUTH_SECRET: 'test-turn-secret',
  TURN_CREDENTIAL_TTL: '86400',

  SIGNALING_ALLOWED_ORIGINS: 'http://localhost:3000',
  WEB_APP_URL: 'http://localhost:3000',
  API_PUBLIC_URL: 'http://localhost:4000',

  AUTH_ACCESS_TOKEN_TTL: '900',
  AUTH_REFRESH_TOKEN_TTL: '2592000',

  WEBAUTHN_RP_ID: 'localhost',
  WEBAUTHN_RP_NAME: 'Cougny',
  MAIL_FROM: 'Cougny <no-reply@localhost>',

  // Optional settings, empty so the features behind them stay off: no shared
  // rate-limit store, no cookie domain, no social sign-in, no outbound mail.
  // Empty rather than deleted — a deleted variable is one `dotenv` would fill
  // back in from `.env`.
  REDIS_URL: '',
  AUTH_COOKIE_DOMAIN: '',
  GOOGLE_OAUTH_CLIENT_ID: '',
  GOOGLE_OAUTH_CLIENT_SECRET: '',
  DISCORD_OAUTH_CLIENT_ID: '',
  DISCORD_OAUTH_CLIENT_SECRET: '',
  SMTP_URL: '',
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] = value;
}

// Read by `@cougny/db`, which the suites mock; a value only has to exist.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?schema=public';
