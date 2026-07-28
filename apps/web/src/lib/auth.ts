import {
  AuthCapabilitiesResponseSchema,
  AuthResponseSchema,
  AuthSessionListResponseSchema,
  PasskeyListResponseSchema,
  PasskeyOptionsResponseSchema,
  UserProfileSchema,
  type AuthCapabilitiesResponse,
  type AuthResponse,
  type AuthSessionListResponse,
  type ChangePasswordRequest,
  type CompleteProfileRequest,
  type LoginRequest,
  type OAuthProvider,
  type PasskeyListResponse,
  type RegisterRequest,
  type UpdateProfileRequest,
  type UserProfile,
} from '@cougny/protocol';
import { clientEnv } from './env';

/**
 * Browser client for the account API.
 *
 * Two rules shape everything here:
 *
 *  * The refresh token is an httpOnly cookie, so every auth request sets
 *    `credentials: 'include'` and no code in this file ever sees that token.
 *  * The access token is held in memory by the auth context and passed in
 *    explicitly, never read from storage — a token in `localStorage` is a token
 *    any injected script can read and keep.
 */

/** An API error carrying the server's machine-readable code. */
export class AuthError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Bearer token for routes that require a signed-in caller. */
  token?: string;
}

async function request(path: string, options: RequestOptions = {}): Promise<unknown> {
  const { method = 'GET', body, token } = options;

  const response = await fetch(`${clientEnv.apiUrl}${path}`, {
    method,
    // Carries the refresh cookie both ways. Without it the cookie the server
    // sets on sign-in would simply be dropped by the browser.
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 204) return null;

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new AuthError(
      error?.code ?? 'request_failed',
      error?.message ?? `Request failed (${response.status})`,
      response.status,
    );
  }

  return payload;
}

/* -------------------------------------------------------------------------- *
 * Sign-up and sign-in
 * -------------------------------------------------------------------------- */

/**
 * What the sign-up form collects. The two attestations are not part of it: the
 * form gates submission on their checkboxes and the caller adds the literal
 * `true`, so neither flag can be carried along as a stale field value.
 */
export type RegisterInput = Omit<RegisterRequest, 'acceptedTerms' | 'acceptedConduct'>;

export async function register(body: RegisterRequest): Promise<AuthResponse> {
  return AuthResponseSchema.parse(await request('/v1/auth/register', { method: 'POST', body }));
}

export async function login(body: LoginRequest): Promise<AuthResponse> {
  return AuthResponseSchema.parse(await request('/v1/auth/login', { method: 'POST', body }));
}

/**
 * Trades the refresh cookie for a new access token. Also the way the app learns
 * it is already signed in on a fresh page load, and how a social sign-in picks
 * up its token after the provider redirect.
 */
export async function refresh(): Promise<AuthResponse> {
  return AuthResponseSchema.parse(await request('/v1/auth/refresh', { method: 'POST' }));
}

export async function logout(): Promise<void> {
  await request('/v1/auth/logout', { method: 'POST' });
}

/*
 * Capabilities are fixed for the life of a deployment, so the in-flight promise
 * is shared: several components can ask on the same screen and still cost one
 * request. A failure clears the cache so the next asker retries rather than
 * inheriting a permanent "nothing is configured".
 */
let capabilities: Promise<AuthCapabilitiesResponse> | null = null;

export async function fetchCapabilities(): Promise<AuthCapabilitiesResponse> {
  capabilities ??= (async () =>
    AuthCapabilitiesResponseSchema.parse(await request('/v1/auth/capabilities')))().catch(
    (error: unknown) => {
      capabilities = null;
      throw error;
    },
  );
  return capabilities;
}

/* -------------------------------------------------------------------------- *
 * Profile
 * -------------------------------------------------------------------------- */

export async function fetchProfile(token: string): Promise<UserProfile> {
  return UserProfileSchema.parse(await request('/v1/auth/me', { token }));
}

export async function completeProfile(
  token: string,
  body: CompleteProfileRequest,
): Promise<UserProfile> {
  return UserProfileSchema.parse(
    await request('/v1/auth/complete-profile', { method: 'POST', body, token }),
  );
}

export async function updateProfile(
  token: string,
  body: UpdateProfileRequest,
): Promise<UserProfile> {
  return UserProfileSchema.parse(await request('/v1/auth/me', { method: 'PATCH', body, token }));
}

export async function deleteAccount(token: string, password?: string): Promise<void> {
  await request('/v1/auth/me', { method: 'DELETE', body: { password }, token });
}

/* -------------------------------------------------------------------------- *
 * Passwords and email
 * -------------------------------------------------------------------------- */

export async function changePassword(token: string, body: ChangePasswordRequest): Promise<void> {
  await request('/v1/auth/password/change', { method: 'POST', body, token });
}

export async function forgotPassword(email: string): Promise<void> {
  await request('/v1/auth/password/forgot', { method: 'POST', body: { email } });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await request('/v1/auth/password/reset', { method: 'POST', body: { token, newPassword } });
}

export async function verifyEmail(token: string): Promise<void> {
  await request('/v1/auth/email/verify', { method: 'POST', body: { token } });
}

export async function resendVerificationEmail(token: string): Promise<void> {
  await request('/v1/auth/email/resend', { method: 'POST', token });
}

/* -------------------------------------------------------------------------- *
 * Devices
 * -------------------------------------------------------------------------- */

export async function fetchSessions(token: string): Promise<AuthSessionListResponse> {
  return AuthSessionListResponseSchema.parse(await request('/v1/auth/sessions', { token }));
}

export async function revokeSession(token: string, id: string): Promise<void> {
  await request(`/v1/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

export async function revokeOtherSessions(token: string): Promise<void> {
  await request('/v1/auth/sessions/revoke-others', { method: 'POST', token });
}

/* -------------------------------------------------------------------------- *
 * Social identities
 * -------------------------------------------------------------------------- */

/**
 * Begins a social sign-in or link. The server returns the provider URL rather
 * than redirecting, so the caller decides when to navigate.
 */
export async function startOAuth(
  provider: OAuthProvider,
  mode: 'login' | 'link',
  token?: string,
): Promise<string> {
  const payload = (await request(`/v1/auth/oauth/${provider}/start?mode=${mode}`, { token })) as {
    authorizationUrl: string;
  };
  return payload.authorizationUrl;
}

export async function unlinkOAuth(token: string, provider: OAuthProvider): Promise<void> {
  await request(`/v1/auth/oauth/${provider}`, { method: 'DELETE', token });
}

/* -------------------------------------------------------------------------- *
 * Passkeys
 * -------------------------------------------------------------------------- */

export async function fetchPasskeys(token: string): Promise<PasskeyListResponse> {
  return PasskeyListResponseSchema.parse(await request('/v1/auth/passkeys', { token }));
}

export async function passkeyRegistrationOptions(token: string): Promise<Record<string, unknown>> {
  const payload = PasskeyOptionsResponseSchema.parse(
    await request('/v1/auth/passkeys/register/options', { method: 'POST', token }),
  );
  return payload.options;
}

export async function finishPasskeyRegistration(
  token: string,
  response: Record<string, unknown>,
  name?: string,
): Promise<void> {
  await request('/v1/auth/passkeys/register', {
    method: 'POST',
    body: { response, name },
    token,
  });
}

export async function passkeyAuthenticationOptions(
  email?: string,
): Promise<Record<string, unknown>> {
  const payload = PasskeyOptionsResponseSchema.parse(
    await request('/v1/auth/passkeys/authenticate/options', {
      method: 'POST',
      body: email ? { email } : {},
    }),
  );
  return payload.options;
}

export async function finishPasskeyAuthentication(
  response: Record<string, unknown>,
): Promise<AuthResponse> {
  return AuthResponseSchema.parse(
    await request('/v1/auth/passkeys/authenticate', { method: 'POST', body: { response } }),
  );
}

export async function renamePasskey(token: string, id: string, name: string): Promise<void> {
  await request(`/v1/auth/passkeys/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { name },
    token,
  });
}

export async function removePasskey(token: string, id: string): Promise<void> {
  await request(`/v1/auth/passkeys/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}
