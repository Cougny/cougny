import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { prisma, type Passkey, type User } from '@cougny/db';
import { env } from '../env.js';
import { signWebAuthnChallenge, verifyWebAuthnChallenge } from './tokens.js';

/**
 * Passkey registration and sign-in.
 *
 * A passkey replaces the password with a key pair whose private half never
 * leaves the user's device and whose signatures are bound by the browser to
 * this exact origin. That binding is the point: a passkey cannot be phished,
 * because it will not produce a signature for any site but ours.
 *
 * Cougny treats passkeys as an additional way into an existing account rather
 * than a way to create one — an account still needs the age attestation and
 * country that a WebAuthn ceremony has no way to supply.
 */

/**
 * The in-flight challenge, parked in a short-lived signed cookie rather than a
 * database row. Signing it is what binds the challenge to this browser: a
 * challenge issued to one visitor cannot be answered from another.
 */
const CHALLENGE_COOKIE_NAME = 'cougny.webauthn';
const CHALLENGE_COOKIE_PATH = '/v1/auth/passkeys';

function challengeCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'none' | 'lax';
  path: string;
  domain?: string;
} {
  return {
    httpOnly: true,
    secure: env.cookiesSecure,
    sameSite: env.cookiesSecure ? 'none' : 'lax',
    path: CHALLENGE_COOKIE_PATH,
    ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
  };
}

export function setChallengeCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(CHALLENGE_COOKIE_NAME, token, { ...challengeCookieOptions(), maxAge: 600 });
}

export function clearChallengeCookie(reply: FastifyReply): void {
  reply.clearCookie(CHALLENGE_COOKIE_NAME, challengeCookieOptions());
}

export function readChallengeCookie(request: FastifyRequest): string | null {
  return request.cookies[CHALLENGE_COOKIE_NAME] ?? null;
}

/**
 * Transports are stored comma-separated. They are only a hint to the browser
 * about where to look for the credential, so an unrecognized value is harmless.
 */
function parseTransports(stored: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!stored) return undefined;
  const transports = stored.split(',').filter(Boolean) as AuthenticatorTransportFuture[];
  return transports.length > 0 ? transports : undefined;
}

export interface RegistrationCeremony {
  options: Record<string, unknown>;
  challengeToken: string;
}

/**
 * Begins registration for a signed-in account.
 *
 * Existing credentials are sent as exclusions so the authenticator refuses to
 * enroll one that is already registered, which would otherwise leave the user
 * with a passkey the account does not recognize.
 */
export async function startRegistration(
  user: User,
  existing: Passkey[],
): Promise<RegistrationCeremony> {
  const options = await generateRegistrationOptions({
    rpName: env.WEBAUTHN_RP_NAME,
    rpID: env.webAuthnRpId,
    // Opaque and stable: the account id, never the email, so re-registering
    // after an address change still resolves to the same account.
    userID: new TextEncoder().encode(user.id),
    userName: user.email ?? user.username ?? user.id,
    userDisplayName: user.displayName ?? user.username ?? undefined,
    // No attestation: Cougny has no reason to identify the make and model of a
    // user's authenticator, and asking for it adds a privacy prompt.
    attestationType: 'none',
    excludeCredentials: existing.map((passkey) => ({
      id: passkey.credentialId,
      transports: parseTransports(passkey.transports),
    })),
    authenticatorSelection: {
      // Discoverable, so the credential can later sign in with no email typed.
      residentKey: 'required',
      userVerification: 'preferred',
    },
  });

  return {
    options: options as unknown as Record<string, unknown>,
    challengeToken: signWebAuthnChallenge({
      challenge: options.challenge,
      ceremony: 'registration',
      userId: user.id,
    }),
  };
}

export interface VerifiedRegistration {
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports: string | null;
  backedUp: boolean;
}

/**
 * Checks the authenticator's attestation against the challenge we issued.
 * Returns null for any failure — a bad ceremony is a rejection, not an error to
 * surface the internals of.
 */
export async function finishRegistration(
  userId: string,
  challengeToken: string,
  response: RegistrationResponseJSON,
): Promise<VerifiedRegistration | null> {
  const claims = verifyWebAuthnChallenge(challengeToken);
  if (!claims || claims.ceremony !== 'registration' || claims.userId !== userId) return null;

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: claims.challenge,
      expectedOrigin: env.webAuthnOrigin,
      expectedRPID: env.webAuthnRpId,
    });

    if (!verification.verified) return null;

    const { credential, credentialBackedUp } = verification.registrationInfo;
    return {
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports?.join(',') ?? null,
      backedUp: credentialBackedUp,
    };
  } catch {
    return null;
  }
}

export interface AuthenticationCeremony {
  options: Record<string, unknown>;
  challengeToken: string;
}

/**
 * Begins a passkey sign-in.
 *
 * With no account named, the credential list is left empty and the browser
 * offers whichever discoverable passkey it holds for this site. That path is
 * also what keeps the ceremony from revealing whether an address is registered:
 * an unknown email produces an ordinary-looking challenge rather than an error.
 */
export async function startAuthentication(
  credentials: Passkey[],
  userId?: string,
): Promise<AuthenticationCeremony> {
  const options = await generateAuthenticationOptions({
    rpID: env.webAuthnRpId,
    allowCredentials: credentials.map((passkey) => ({
      id: passkey.credentialId,
      transports: parseTransports(passkey.transports),
    })),
    userVerification: 'preferred',
  });

  return {
    options: options as unknown as Record<string, unknown>,
    challengeToken: signWebAuthnChallenge({
      challenge: options.challenge,
      ceremony: 'authentication',
      ...(userId ? { userId } : {}),
    }),
  };
}

/**
 * Verifies an assertion and returns the passkey that produced it, or null.
 *
 * The signature counter is checked as well as the signature: an authenticator
 * whose counter fails to advance has been cloned, and the assertion is refused
 * even though the cryptography checks out. Authenticators that report a
 * constant zero — which the specification permits — are exempt, since for them
 * the counter carries no information.
 */
export async function finishAuthentication(
  challengeToken: string,
  response: AuthenticationResponseJSON,
): Promise<Passkey | null> {
  const claims = verifyWebAuthnChallenge(challengeToken);
  if (!claims || claims.ceremony !== 'authentication') return null;

  const passkey = await prisma.passkey.findUnique({ where: { credentialId: response.id } });
  if (!passkey) return null;

  // A ceremony started for a named account must be answered by that account's
  // credential, so one user's passkey cannot complete another's sign-in.
  if (claims.userId && claims.userId !== passkey.userId) return null;

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: claims.challenge,
      expectedOrigin: env.webAuthnOrigin,
      expectedRPID: env.webAuthnRpId,
      credential: {
        id: passkey.credentialId,
        publicKey: passkey.publicKey,
        counter: Number(passkey.counter),
        transports: parseTransports(passkey.transports),
      },
    });

    if (!verification.verified) return null;

    await prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
        backedUp: verification.authenticationInfo.credentialBackedUp,
      },
    });

    return passkey;
  } catch {
    return null;
  }
}
