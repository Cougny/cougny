import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { prisma, AuthEvent, UserStatus } from '@cougny/db';
import {
  AuthResponseSchema,
  ErrorResponseSchema,
  OkResponseSchema,
  PasskeyAuthenticationOptionsRequestSchema,
  PasskeyAuthenticationRequestSchema,
  PasskeyListResponseSchema,
  PasskeyOptionsResponseSchema,
  PasskeyRegistrationRequestSchema,
  RenamePasskeyRequestSchema,
  type AuthResponse,
  type OkResponse,
  type PasskeyListResponse,
  type PasskeyOptionsResponse,
} from '@cougny/protocol';
import { recordAuthEvent } from '../auth/audit.js';
import { requireUser } from '../auth/guards.js';
import {
  clearChallengeCookie,
  finishAuthentication,
  finishRegistration,
  readChallengeCookie,
  setChallengeCookie,
  startAuthentication,
  startRegistration,
} from '../auth/passkeys.js';
import { completeSignIn } from '../auth/sign-in.js';

const PasskeyIdParamsSchema = z.object({ id: z.string().min(1) });

/** Passkey enrollment and sign-in. See `auth/passkeys.ts` for the mechanics. */
export async function registerPasskeyRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  /* --------------------------------------------------------------------- *
   * Enrollment (signed in)
   * --------------------------------------------------------------------- */

  typed.post(
    '/auth/passkeys/register/options',
    {
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
      schema: {
        tags: ['auth'],
        summary: 'Begin registering a passkey',
        security: [{ bearerAuth: [] }],
        response: {
          200: PasskeyOptionsResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<PasskeyOptionsResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      const existing = await prisma.passkey.findMany({ where: { userId: caller.user.id } });
      const ceremony = await startRegistration(caller.user, existing);

      setChallengeCookie(reply, ceremony.challengeToken);
      return { options: ceremony.options };
    },
  );

  typed.post(
    '/auth/passkeys/register',
    {
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
      schema: {
        tags: ['auth'],
        summary: 'Finish registering a passkey',
        security: [{ bearerAuth: [] }],
        body: PasskeyRegistrationRequestSchema,
        response: {
          201: OkResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          409: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<OkResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      const challengeToken = readChallengeCookie(request);
      clearChallengeCookie(reply);

      if (!challengeToken) {
        reply.code(400).send({
          error: { code: 'no_challenge', message: 'Start the passkey setup again.' },
        });
        return;
      }

      const verified = await finishRegistration(
        caller.user.id,
        challengeToken,
        request.body.response as unknown as RegistrationResponseJSON,
      );

      if (!verified) {
        reply.code(400).send({
          error: { code: 'verification_failed', message: 'That passkey could not be verified.' },
        });
        return;
      }

      try {
        await prisma.passkey.create({
          data: {
            userId: caller.user.id,
            credentialId: verified.credentialId,
            publicKey: Buffer.from(verified.publicKey),
            counter: BigInt(verified.counter),
            transports: verified.transports,
            backedUp: verified.backedUp,
            name: request.body.name ?? null,
          },
        });
      } catch {
        // The credential id is globally unique; a collision means this
        // authenticator is already enrolled, here or on another account.
        reply.code(409).send({
          error: { code: 'already_registered', message: 'That passkey is already registered.' },
        });
        return;
      }

      recordAuthEvent(AuthEvent.PASSKEY_REGISTERED, { userId: caller.user.id, request });
      reply.code(201);
      return { ok: true };
    },
  );

  /* --------------------------------------------------------------------- *
   * Sign-in
   * --------------------------------------------------------------------- */

  typed.post(
    '/auth/passkeys/authenticate/options',
    {
      config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
      schema: {
        tags: ['auth'],
        summary: 'Begin signing in with a passkey',
        body: PasskeyAuthenticationOptionsRequestSchema,
        response: { 200: PasskeyOptionsResponseSchema, 429: ErrorResponseSchema },
      },
    },
    async (request, reply): Promise<PasskeyOptionsResponse> => {
      const { email } = request.body;

      const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
      const credentials = user ? await prisma.passkey.findMany({ where: { userId: user.id } }) : [];

      /*
       * An unknown address produces an ordinary challenge with an empty
       * credential list rather than an error — indistinguishable from an
       * address that simply has no passkey, so this cannot be used to test
       * whether someone has an account here.
       */
      const ceremony = await startAuthentication(credentials, user?.id);
      setChallengeCookie(reply, ceremony.challengeToken);
      return { options: ceremony.options };
    },
  );

  typed.post(
    '/auth/passkeys/authenticate',
    {
      config: { rateLimit: { max: 30, timeWindow: '15 minutes' } },
      schema: {
        tags: ['auth'],
        summary: 'Finish signing in with a passkey',
        body: PasskeyAuthenticationRequestSchema,
        response: {
          200: AuthResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<AuthResponse | void> => {
      const challengeToken = readChallengeCookie(request);
      clearChallengeCookie(reply);

      if (!challengeToken) {
        reply
          .code(400)
          .send({ error: { code: 'no_challenge', message: 'Start signing in again.' } });
        return;
      }

      const passkey = await finishAuthentication(
        challengeToken,
        request.body.response as unknown as AuthenticationResponseJSON,
      );

      if (!passkey) {
        recordAuthEvent(AuthEvent.LOGIN_FAILED, { request, detail: 'passkey' });
        reply.code(401).send({
          error: { code: 'verification_failed', message: 'That passkey could not be verified.' },
        });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: passkey.userId } });
      if (!user || user.status !== UserStatus.ACTIVE) {
        reply.code(403).send({
          error: { code: 'account_unavailable', message: 'This account cannot be used.' },
        });
        return;
      }

      recordAuthEvent(AuthEvent.PASSKEY_LOGIN_SUCCEEDED, { userId: user.id, request });
      return completeSignIn(user.id, request, reply);
    },
  );

  /* --------------------------------------------------------------------- *
   * Management
   * --------------------------------------------------------------------- */

  typed.get(
    '/auth/passkeys',
    {
      schema: {
        tags: ['auth'],
        summary: 'List the account’s passkeys',
        security: [{ bearerAuth: [] }],
        response: {
          200: PasskeyListResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<PasskeyListResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      const passkeys = await prisma.passkey.findMany({
        where: { userId: caller.user.id },
        orderBy: { createdAt: 'asc' },
      });

      return {
        passkeys: passkeys.map((passkey) => ({
          id: passkey.id,
          name: passkey.name,
          createdAt: passkey.createdAt.toISOString(),
          lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null,
          backedUp: passkey.backedUp,
        })),
      };
    },
  );

  typed.patch(
    '/auth/passkeys/:id',
    {
      schema: {
        tags: ['auth'],
        summary: 'Rename a passkey',
        security: [{ bearerAuth: [] }],
        params: PasskeyIdParamsSchema,
        body: RenamePasskeyRequestSchema,
        response: {
          200: OkResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<OkResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      // Scoped by userId as well as id, so one account cannot rename another's.
      const { count } = await prisma.passkey.updateMany({
        where: { id: request.params.id, userId: caller.user.id },
        data: { name: request.body.name },
      });

      if (count === 0) {
        reply.code(404).send({ error: { code: 'not_found', message: 'No such passkey.' } });
        return;
      }
      return { ok: true };
    },
  );

  typed.delete(
    '/auth/passkeys/:id',
    {
      schema: {
        tags: ['auth'],
        summary: 'Remove a passkey',
        security: [{ bearerAuth: [] }],
        params: PasskeyIdParamsSchema,
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

      const [passkeyCount, linkCount] = await Promise.all([
        prisma.passkey.count({ where: { userId: caller.user.id } }),
        prisma.oAuthAccount.count({ where: { userId: caller.user.id } }),
      ]);

      // Same guard as unlinking a social account: never remove the last way in.
      const remainingMethods =
        (caller.user.passwordHash ? 1 : 0) + linkCount + Math.max(passkeyCount - 1, 0);
      if (remainingMethods === 0) {
        reply.code(409).send({
          error: {
            code: 'last_sign_in_method',
            message: 'Set a password or link an account before removing this passkey.',
          },
        });
        return;
      }

      const { count } = await prisma.passkey.deleteMany({
        where: { id: request.params.id, userId: caller.user.id },
      });
      if (count === 0) {
        reply.code(404).send({ error: { code: 'not_found', message: 'No such passkey.' } });
        return;
      }

      recordAuthEvent(AuthEvent.PASSKEY_REMOVED, { userId: caller.user.id, request });
      return { ok: true };
    },
  );
}
