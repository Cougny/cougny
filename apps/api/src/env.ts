import { config } from 'dotenv';
import { z } from 'zod';

config();

/** Seconds in a day, for readable TTL defaults. */
const DAY = 86_400;

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  AUTH_JWT_SECRET: z.string().min(16, 'AUTH_JWT_SECRET must be at least 16 characters'),

  // WebRTC ICE.
  STUN_URL: z.string().default('stun:localhost:3478'),
  TURN_URL: z.string().default('turn:localhost:3478'),
  TURN_STATIC_AUTH_SECRET: z.string().min(8),
  TURN_CREDENTIAL_TTL: z.coerce.number().int().positive().default(86_400),

  // Browser origins allowed to call the API.
  SIGNALING_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Optional shared Redis for rate limiting across API instances. When unset,
  // limits are tracked in-process (fine for a single instance / local dev).
  REDIS_URL: z.string().optional(),

  // --- Accounts ---

  /**
   * Where the browser-facing app lives. Email links and OAuth hand-offs land
   * here, and it is the only host they are ever allowed to point at.
   */
  WEB_APP_URL: z.url().default('http://localhost:3000'),
  /**
   * This API's own externally reachable origin. OAuth `redirect_uri` values are
   * built from it, so it must match what is registered with each provider.
   */
  API_PUBLIC_URL: z.url().default('http://localhost:4000'),

  /** Access-token lifetime. Short: a refresh token trades up for a new one. */
  AUTH_ACCESS_TOKEN_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  /** Refresh-token lifetime, and therefore how long "stay signed in" lasts. */
  AUTH_REFRESH_TOKEN_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * DAY),
  /**
   * Domain for the refresh cookie. Set to a shared parent (`.cougny.com`) when
   * the API and web app are on different subdomains; leave unset for localhost.
   */
  AUTH_COOKIE_DOMAIN: z.string().optional(),

  /** Google OAuth 2.0 credentials. Google sign-in is offered only when set. */
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  /** Discord OAuth 2.0 credentials. Discord sign-in is offered only when set. */
  DISCORD_OAUTH_CLIENT_ID: z.string().optional(),
  DISCORD_OAUTH_CLIENT_SECRET: z.string().optional(),

  /**
   * WebAuthn relying party. The id must be the registered domain the web app is
   * served from (or a parent of it) — a passkey is bound to it and will not be
   * offered on any other origin. Defaults to the hostname of `WEB_APP_URL`.
   */
  WEBAUTHN_RP_ID: z.string().optional(),
  /** Human-readable relying party name, shown in the platform's passkey UI. */
  WEBAUTHN_RP_NAME: z.string().default('Cougny'),

  /**
   * SMTP connection string for verification and password-reset mail. When
   * unset, messages are written to the log instead of sent — fine for local
   * development, and startup warns about it in production.
   */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Cougny <no-reply@localhost>'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid API environment:', z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  corsOrigins: parsed.data.SIGNALING_ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  /**
   * Cookies are `Secure` everywhere but local HTTP development. Derived rather
   * than configured so a production deployment cannot forget to set it.
   */
  cookiesSecure: parsed.data.NODE_ENV === 'production',
  /**
   * WebAuthn binds every credential to a relying party id and asserts against
   * an exact origin, both of which follow from where the web app is served.
   */
  webAuthnRpId: parsed.data.WEBAUTHN_RP_ID ?? new URL(parsed.data.WEB_APP_URL).hostname,
  webAuthnOrigin: new URL(parsed.data.WEB_APP_URL).origin,
};
