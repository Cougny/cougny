import { createHash, randomBytes } from 'node:crypto';
import type { OAuthProvider } from '@cougny/protocol';
import { env } from '../env.js';

/**
 * Authorization-code sign-in with Google and Discord.
 *
 * Implemented against the providers' HTTP endpoints directly rather than
 * through a framework: the flow is small, and doing it here keeps every
 * security decision — PKCE, state, which endpoint the profile comes from —
 * visible in one file.
 *
 * Note what is *not* trusted: the identity is keyed on the provider's immutable
 * subject id, never on the email it reports. Emails change hands at the
 * provider, and keying on one would let a recycled address take over an account.
 */

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  clientId: string | undefined;
  clientSecret: string | undefined;
  /** Pulls the provider's own JSON shape into the fields we store. */
  parseProfile: (payload: unknown) => ProviderProfile | null;
}

/** The subset of a provider's profile Cougny keeps. */
export interface ProviderProfile {
  /** The provider's stable subject id. The only field an account is keyed on. */
  id: string;
  email: string | null;
  /** True only when the provider states the address is verified. */
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
}

function asRecord(payload: unknown): Record<string, unknown> | null {
  return typeof payload === 'object' && payload !== null
    ? (payload as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const PROVIDERS: Record<OAuthProvider, ProviderConfig> = {
  google: {
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    /*
     * The OIDC userinfo endpoint, deliberately in preference to decoding the
     * id_token: the access token was just fetched over TLS from Google's own
     * token endpoint, so this needs no JWKS fetch and no signature validation
     * of our own — two things that are easy to get subtly wrong.
     */
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile'],
    clientId: env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    parseProfile: (payload) => {
      const data = asRecord(payload);
      const id = data && asString(data.sub);
      if (!data || !id) return null;
      return {
        id,
        email: asString(data.email),
        emailVerified: data.email_verified === true,
        displayName: asString(data.name) ?? asString(data.given_name),
        avatarUrl: asString(data.picture),
      };
    },
  },
  discord: {
    authorizeUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/v10/users/@me',
    scopes: ['identify', 'email'],
    clientId: env.DISCORD_OAUTH_CLIENT_ID,
    clientSecret: env.DISCORD_OAUTH_CLIENT_SECRET,
    parseProfile: (payload) => {
      const data = asRecord(payload);
      const id = data && asString(data.id);
      if (!data || !id) return null;
      const avatarHash = asString(data.avatar);
      return {
        id,
        email: asString(data.email),
        emailVerified: data.verified === true,
        displayName: asString(data.global_name) ?? asString(data.username),
        avatarUrl: avatarHash ? `https://cdn.discordapp.com/avatars/${id}/${avatarHash}.png` : null,
      };
    },
  },
};

/**
 * A provider is offered only once its credentials are configured, so a
 * half-provisioned deployment shows the buttons it can actually honour.
 */
export function isProviderConfigured(provider: OAuthProvider): boolean {
  const config = PROVIDERS[provider];
  return Boolean(config.clientId && config.clientSecret);
}

export function configuredProviders(): OAuthProvider[] {
  return (Object.keys(PROVIDERS) as OAuthProvider[]).filter(isProviderConfigured);
}

/**
 * Where the provider sends the browser back. Fixed server-side and registered
 * with the provider, so the authorization code can only ever be delivered here.
 */
function redirectUri(provider: OAuthProvider): string {
  return new URL(`/v1/auth/oauth/${provider}/callback`, env.API_PUBLIC_URL).toString();
}

/** PKCE pair: the verifier is kept, its S256 challenge is sent. */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function createStateNonce(): string {
  return randomBytes(16).toString('base64url');
}

/** Builds the URL that starts the ceremony in the user's browser. */
export function authorizationUrl(
  provider: OAuthProvider,
  state: string,
  codeChallenge: string,
): string {
  const config = PROVIDERS[provider];
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.clientId ?? '');
  url.searchParams.set('redirect_uri', redirectUri(provider));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // Google only returns the account chooser (rather than silently reusing the
  // one signed-in account) when asked to.
  if (provider === 'google') url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

class OAuthError extends Error {}

/** Exchanges the authorization code for an access token. */
async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  codeVerifier: string,
): Promise<string> {
  const config = PROVIDERS[provider];

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(provider),
      client_id: config.clientId ?? '',
      client_secret: config.clientSecret ?? '',
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new OAuthError(`${provider} token exchange failed with ${response.status}`);
  }

  const payload = asRecord(await response.json());
  const accessToken = payload && asString(payload.access_token);
  if (!accessToken) throw new OAuthError(`${provider} token response had no access token`);
  return accessToken;
}

/**
 * Completes the ceremony: code in, provider profile out. Throws on any provider
 * failure; callers turn that into a redirect back to the web app with an error,
 * never a raw 500 in the middle of a sign-in.
 */
export async function fetchProviderProfile(
  provider: OAuthProvider,
  code: string,
  codeVerifier: string,
): Promise<ProviderProfile> {
  const config = PROVIDERS[provider];
  const accessToken = await exchangeCode(provider, code, codeVerifier);

  const response = await fetch(config.userInfoUrl, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
  });
  if (!response.ok) {
    throw new OAuthError(`${provider} profile request failed with ${response.status}`);
  }

  const profile = config.parseProfile(await response.json());
  if (!profile) throw new OAuthError(`${provider} profile response was missing a subject id`);
  return profile;
}
