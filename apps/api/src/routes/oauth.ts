import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { Prisma, prisma, AuthEvent, type User } from '@cougny/db';
import {
  ErrorResponseSchema,
  OAuthProviderSchema,
  OAuthStartResponseSchema,
  OkResponseSchema,
  type OAuthProvider,
  type OAuthStartResponse,
  type OkResponse,
} from '@cougny/protocol';
import { env } from '../env.js';
import { recordAuthEvent } from '../auth/audit.js';
import { requireUser } from '../auth/guards.js';
import {
  authorizationUrl,
  createPkcePair,
  createStateNonce,
  fetchProviderProfile,
  isProviderConfigured,
  type ProviderProfile,
} from '../auth/oauth.js';
import { WIRE_TO_DB_PROVIDER } from '../auth/profile.js';
import { issueSession, setRefreshCookie } from '../auth/sessions.js';
import { signOAuthState, verifyOAuthState } from '../auth/tokens.js';

/**
 * Google and Discord sign-in.
 *
 * The ceremony's state lives in a signed, short-lived cookie rather than a
 * table, so a browser that abandons the flow leaves nothing behind. See
 * `auth/oauth.ts` for the provider mechanics.
 */

/** Where the half-finished ceremony's signed state is parked. */
const STATE_COOKIE_NAME = 'cougny.oauth';
const STATE_COOKIE_PATH = '/v1/auth/oauth';

const ProviderParamsSchema = z.object({ provider: OAuthProviderSchema });

const StartQuerySchema = z.object({
  /**
   * `link` attaches the identity to the account already signed in, and requires
   * a bearer token. `login` is the default and needs none.
   */
  mode: z.enum(['login', 'link']).default('login'),
});

/**
 * Google and Discord both hand the browser back with these query parameters.
 * `error` arrives instead of `code` when the user declines the consent screen.
 */
const CallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

function stateCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  domain?: string;
} {
  return {
    httpOnly: true,
    secure: env.cookiesSecure,
    /**
     * `lax`, not `none`: the callback is a top-level navigation the provider
     * initiates, which `lax` allows, and keeping it there means the cookie is
     * not attached to arbitrary cross-site subrequests.
     */
    sameSite: 'lax',
    path: STATE_COOKIE_PATH,
    ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
  };
}

/**
 * Sends the browser back to the web app. Built from `WEB_APP_URL`, never from
 * anything in the request, so the callback cannot be turned into an open
 * redirect that forwards an authorization code to another site.
 */
function redirectToApp(reply: FastifyReply, path: string, params: Record<string, string>): void {
  const url = new URL(path, env.WEB_APP_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  reply.redirect(url.toString(), 303);
}

/**
 * Resolves a provider identity to an account, creating one if this identity has
 * never been seen.
 *
 * Matching is by the provider's subject id first. An account is only ever
 * *adopted* by email when the provider states that address is verified — an
 * unverified one would let anybody who can claim an address at the provider
 * walk into the matching Cougny account.
 */
async function resolveAccount(
  provider: OAuthProvider,
  profile: ProviderProfile,
  request: FastifyRequest,
): Promise<User> {
  const dbProvider = WIRE_TO_DB_PROVIDER[provider];

  const linked = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: dbProvider, providerAccountId: profile.id } },
    include: { user: true },
  });
  if (linked) return linked.user;

  if (profile.email && profile.emailVerified) {
    const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (byEmail) {
      await prisma.oAuthAccount.create({
        data: {
          provider: dbProvider,
          providerAccountId: profile.id,
          label: profile.email ?? profile.displayName,
          userId: byEmail.id,
        },
      });
      recordAuthEvent(AuthEvent.OAUTH_LINKED, {
        userId: byEmail.id,
        request,
        detail: provider,
      });
      return byEmail;
    }
  }

  /*
   * A brand-new account. It is deliberately left incomplete: `dateOfBirth`,
   * `country`, and `termsAcceptedAt` stay null because no provider can vouch
   * for them, and `profileCompletedAt` therefore stays null too. The client
   * routes the user to the completion step, and until they finish it the
   * account cannot be used.
   */
  const created = await prisma.user.create({
    data: {
      email: profile.email,
      // Only a provider-asserted verification counts; we do not re-derive one.
      emailVerifiedAt: profile.email && profile.emailVerified ? new Date() : null,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      oauthAccounts: {
        create: {
          provider: dbProvider,
          providerAccountId: profile.id,
          label: profile.email ?? profile.displayName,
        },
      },
    },
  });

  recordAuthEvent(AuthEvent.REGISTERED, { userId: created.id, request, detail: provider });
  return created;
}

export async function registerOAuthRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/auth/oauth/:provider/start',
    {
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
      schema: {
        tags: ['auth'],
        summary: 'Begin a social sign-in',
        params: ProviderParamsSchema,
        querystring: StartQuerySchema,
        response: {
          200: OAuthStartResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<OAuthStartResponse | void> => {
      const { provider } = request.params;
      const { mode } = request.query;

      if (!isProviderConfigured(provider)) {
        reply.code(404).send({
          error: { code: 'provider_unavailable', message: 'That sign-in method is not available.' },
        });
        return;
      }

      // Linking attaches an identity to a specific account, so the caller must
      // already be that account — the target is taken from the token, never
      // from a parameter.
      let userId: string | undefined;
      if (mode === 'link') {
        const caller = await requireUser(request, reply);
        if (!caller) return;
        userId = caller.user.id;
      }

      const state = createStateNonce();
      const { verifier, challenge } = createPkcePair();

      reply.setCookie(
        STATE_COOKIE_NAME,
        signOAuthState({
          provider,
          state,
          codeVerifier: verifier,
          mode,
          ...(userId ? { userId } : {}),
        }),
        { ...stateCookieOptions(), maxAge: 600 },
      );

      return { authorizationUrl: authorizationUrl(provider, state, challenge) };
    },
  );

  /**
   * The provider redirects the browser here. This is a navigation, not an API
   * call, so every outcome ends in a redirect back to the web app carrying a
   * status the UI can render — never a JSON error the user would see raw.
   */
  app.withTypeProvider<ZodTypeProvider>().get(
    '/auth/oauth/:provider/callback',
    {
      config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
      schema: {
        tags: ['auth'],
        summary: 'Social sign-in callback',
        params: ProviderParamsSchema,
        querystring: CallbackQuerySchema,
        // A redirect has no body to describe, and the browser is the only
        // caller, so this stays out of the generated client surface.
        hide: true,
      },
    },
    async (request, reply): Promise<void> => {
      const { provider } = request.params;
      const { code, state, error } = request.query;

      const stateCookie = request.cookies[STATE_COOKIE_NAME];
      reply.clearCookie(STATE_COOKIE_NAME, stateCookieOptions());

      if (error) {
        redirectToApp(reply, '/login', { error: 'cancelled' });
        return;
      }

      const claims = stateCookie ? verifyOAuthState(stateCookie) : null;

      /*
       * The CSRF check. Without it, an attacker could deliver their own
       * authorization code to a victim's browser and have the victim's session
       * bound to the attacker's identity. The nonce must match the one this
       * browser was issued, and the provider must be the one it was issued for.
       */
      if (!claims || !code || !state || claims.state !== state || claims.provider !== provider) {
        redirectToApp(reply, '/login', { error: 'invalid_state' });
        return;
      }

      let profile: ProviderProfile;
      try {
        profile = await fetchProviderProfile(provider, code, claims.codeVerifier);
      } catch (err) {
        request.log.warn({ err, provider }, 'oauth profile exchange failed');
        redirectToApp(reply, '/login', { error: 'provider_error' });
        return;
      }

      if (claims.mode === 'link' && claims.userId) {
        await linkIdentity(claims.userId, provider, profile, request, reply);
        return;
      }

      const user = await resolveAccount(provider, profile, request);

      if (user.status !== 'ACTIVE') {
        redirectToApp(reply, '/login', { error: 'account_unavailable' });
        return;
      }

      const { session, refreshToken } = await issueSession(user.id, request);
      setRefreshCookie(reply, refreshToken);
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      recordAuthEvent(AuthEvent.LOGIN_SUCCEEDED, {
        userId: user.id,
        request,
        detail: provider,
      });

      /*
       * No access token in the URL. The refresh cookie is now set, so the web
       * app calls `/auth/refresh` on arrival to pick up an access token — which
       * keeps the credential out of browser history, the Referer header, and
       * any logs along the way.
       */
      redirectToApp(reply, '/auth/callback', { session: session.id });
    },
  );

  typed.delete(
    '/auth/oauth/:provider',
    {
      schema: {
        tags: ['auth'],
        summary: 'Unlink a social identity',
        security: [{ bearerAuth: [] }],
        params: ProviderParamsSchema,
        response: {
          200: OkResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<OkResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      const dbProvider = WIRE_TO_DB_PROVIDER[request.params.provider];
      const [links, passkeyCount] = await Promise.all([
        prisma.oAuthAccount.findMany({ where: { userId: caller.user.id } }),
        prisma.passkey.count({ where: { userId: caller.user.id } }),
      ]);

      if (!links.some((link) => link.provider === dbProvider)) {
        reply
          .code(404)
          .send({ error: { code: 'not_linked', message: 'That account is not linked.' } });
        return;
      }

      // Refuse to remove the last way in. Otherwise unlinking a social identity
      // from an account that never set a password locks its owner out for good.
      const remainingMethods =
        (caller.user.passwordHash ? 1 : 0) + passkeyCount + (links.length - 1);
      if (remainingMethods === 0) {
        reply.code(409).send({
          error: {
            code: 'last_sign_in_method',
            message: 'Set a password or add a passkey before unlinking this account.',
          },
        });
        return;
      }

      await prisma.oAuthAccount.deleteMany({
        where: { userId: caller.user.id, provider: dbProvider },
      });
      recordAuthEvent(AuthEvent.OAUTH_UNLINKED, {
        userId: caller.user.id,
        request,
        detail: request.params.provider,
      });
      return { ok: true };
    },
  );
}

/** Attaches a provider identity to an account that is already signed in. */
async function linkIdentity(
  userId: string,
  provider: OAuthProvider,
  profile: ProviderProfile,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await prisma.oAuthAccount.create({
      data: {
        provider: WIRE_TO_DB_PROVIDER[provider],
        providerAccountId: profile.id,
        label: profile.email ?? profile.displayName,
        userId,
      },
    });
  } catch (error) {
    // Either this identity already belongs to someone else, or this account
    // already has an identity from this provider. Both are unique-constraint
    // violations, and both mean the link cannot be made.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      redirectToApp(reply, '/account', { error: 'already_linked' });
      return;
    }
    throw error;
  }

  recordAuthEvent(AuthEvent.OAUTH_LINKED, { userId, request, detail: provider });
  redirectToApp(reply, '/account', { linked: provider });
}
