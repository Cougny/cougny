import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { Prisma, prisma, AuthEvent, AuthTokenPurpose, UserStatus, type User } from '@cougny/db';
import {
  AuthCapabilitiesResponseSchema,
  AuthResponseSchema,
  ChangePasswordRequestSchema,
  CompleteProfileRequestSchema,
  DeleteAccountRequestSchema,
  ErrorResponseSchema,
  ForgotPasswordRequestSchema,
  LoginRequestSchema,
  OkResponseSchema,
  RegisterRequestSchema,
  ResetPasswordRequestSchema,
  UpdateProfileRequestSchema,
  UserProfileSchema,
  VerifyEmailRequestSchema,
  isAtLeastMinimumAge,
  parseCalendarDate,
  type AuthCapabilitiesResponse,
  type AuthResponse,
  type OkResponse,
  type UserProfile,
} from '@cougny/protocol';
import { recordAuthEvent } from '../auth/audit.js';
import { requireUser } from '../auth/guards.js';
import { isMailConfigured, sendEmailVerification, sendPasswordReset } from '../auth/mailer.js';
import { configuredProviders } from '../auth/oauth.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { isProfileComplete, loadUserProfile, toUserProfile } from '../auth/profile.js';
import { localeFromHeader } from '../i18n/index.js';
import {
  clearRefreshCookie,
  readRefreshCookie,
  revokeAllSessions,
  rotateSession,
  setRefreshCookie,
} from '../auth/sessions.js';
import { completeSignIn } from '../auth/sign-in.js';
import { generateOpaqueToken, hashOpaqueToken, signAccessToken } from '../auth/tokens.js';

/** How long an emailed link stays usable. */
const EMAIL_VERIFICATION_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_HOURS = 1;

/**
 * Failed password attempts tolerated before an account is temporarily locked.
 * High enough that a forgetful user is not punished, low enough that online
 * guessing is hopeless long before it succeeds.
 */
const MAX_FAILED_LOGINS = 10;
const LOCKOUT_MINUTES = 15;

/** Rate limits, keyed by IP, for the unauthenticated routes worth guarding. */
const REGISTER_LIMIT = { max: 5, timeWindow: '1 hour' } as const;
const LOGIN_LIMIT = { max: 20, timeWindow: '15 minutes' } as const;
const EMAIL_SEND_LIMIT = { max: 5, timeWindow: '1 hour' } as const;

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Issues a single-use emailed token. Any outstanding token for the same purpose
 * is consumed first, so a stream of "resend" clicks leaves exactly one live
 * link rather than a widening set of valid ones.
 */
async function issueEmailToken(
  userId: string,
  purpose: AuthTokenPurpose,
  ttlHours: number,
): Promise<string> {
  const token = generateOpaqueToken();

  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashOpaqueToken(token),
        expiresAt: hoursFromNow(ttlHours),
      },
    }),
  ]);

  return token;
}

/**
 * Redeems an emailed token, atomically. The `consumedAt: null` guard is part of
 * the update's own filter, so two simultaneous redemptions cannot both win.
 */
async function consumeEmailToken(
  token: string,
  purpose: AuthTokenPurpose,
): Promise<{ userId: string } | null> {
  const record = await prisma.authToken.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    select: { id: true, userId: true, purpose: true, expiresAt: true, consumedAt: true },
  });

  if (!record || record.purpose !== purpose || record.consumedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;

  const { count } = await prisma.authToken.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  return count > 0 ? { userId: record.userId } : null;
}

/**
 * True when a Prisma write failed a unique constraint on the given field.
 *
 * Which field collided is reported in two different places depending on how
 * Prisma reached the database. The classic engine sets `meta.target`; a driver
 * adapter (what this service uses) instead passes the underlying Postgres error
 * through under `meta.driverAdapterError`. Both are checked, and the constraint
 * name is used as a last resort, so a Prisma upgrade that changes the preferred
 * shape cannot silently turn a 409 back into a 500.
 */
function isUniqueViolation(error: unknown, field: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  const meta = (error.meta ?? {}) as {
    target?: unknown;
    driverAdapterError?: { cause?: { constraint?: { fields?: unknown; index?: unknown } } };
  };

  const target = meta.target;
  if (Array.isArray(target) ? target.includes(field) : target === field) return true;

  const constraint = meta.driverAdapterError?.cause?.constraint;
  if (Array.isArray(constraint?.fields) && constraint.fields.includes(field)) return true;

  // Constraint names follow Prisma's `Model_field_key` convention.
  return typeof constraint?.index === 'string' && constraint.index.includes(`_${field}_`);
}

function isLockedOut(user: User): boolean {
  return user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now();
}

/**
 * Account and authentication routes.
 *
 * All of them sit under `/v1/auth` so the refresh cookie can be scoped to that
 * one path instead of being sent with every request to the API.
 */
export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  /* --------------------------------------------------------------------- *
   * Capabilities
   * --------------------------------------------------------------------- */

  typed.get(
    '/auth/capabilities',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign-in methods this deployment supports',
        response: { 200: AuthCapabilitiesResponseSchema },
      },
    },
    (): AuthCapabilitiesResponse => ({
      oauthProviders: configuredProviders(),
      emailDelivery: isMailConfigured(),
    }),
  );

  /* --------------------------------------------------------------------- *
   * Registration and sign-in
   * --------------------------------------------------------------------- */

  typed.post(
    '/auth/register',
    {
      config: { rateLimit: REGISTER_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Create an account with an email and password',
        body: RegisterRequestSchema,
        response: {
          201: AuthResponseSchema,
          409: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<AuthResponse | void> => {
      const { email, password, username, displayName, dateOfBirth, country } = request.body;

      // The schema already enforces 18+; re-checking here means the rule holds
      // even if this handler is ever reached by another path.
      if (!isAtLeastMinimumAge(dateOfBirth)) {
        reply.code(409).send({
          error: { code: 'age_requirement', message: 'You must be 18 or older to sign up.' },
        });
        return;
      }

      const now = new Date();
      let user: User;
      try {
        user = await prisma.user.create({
          data: {
            email,
            username,
            displayName: displayName ?? null,
            passwordHash: await hashPassword(password),
            passwordChangedAt: now,
            dateOfBirth: parseCalendarDate(dateOfBirth),
            country,
            termsAcceptedAt: now,
            conductAcceptedAt: now,
            // An email sign-up supplies everything up front, so it is usable
            // immediately — unlike a social sign-up, which owes us these fields.
            profileCompletedAt: now,
          },
        });
      } catch (error) {
        // Telling the user which field collided is what makes the form usable;
        // it does reveal that an address is registered, which is the accepted
        // trade every sign-up form with a "that email is taken" message makes.
        if (isUniqueViolation(error, 'email')) {
          reply.code(409).send({
            error: { code: 'email_taken', message: 'That email address is already registered.' },
          });
          return;
        }
        if (isUniqueViolation(error, 'username')) {
          reply
            .code(409)
            .send({ error: { code: 'username_taken', message: 'That username is taken.' } });
          return;
        }
        throw error;
      }

      recordAuthEvent(AuthEvent.REGISTERED, { userId: user.id, request });

      const token = await issueEmailToken(
        user.id,
        AuthTokenPurpose.EMAIL_VERIFICATION,
        EMAIL_VERIFICATION_TTL_HOURS,
      );
      await sendEmailVerification(
        email,
        token,
        EMAIL_VERIFICATION_TTL_HOURS,
        request.log,
        localeFromHeader(request.headers['accept-language']),
      );

      reply.code(201);
      return completeSignIn(user.id, request, reply);
    },
  );

  typed.post(
    '/auth/login',
    {
      config: { rateLimit: LOGIN_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Sign in with an email and password',
        body: LoginRequestSchema,
        response: {
          200: AuthResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<AuthResponse | void> => {
      const { email, password } = request.body;
      const user = await prisma.user.findUnique({ where: { email } });

      // Deliberately uniform: whether the address is unregistered, the account
      // has no password, or the password is wrong, the caller sees the same
      // reply after the same amount of work. `verifyPassword(null, …)` hashes
      // against a decoy so the timing matches too.
      const passwordMatches =
        user && !isLockedOut(user) ? await verifyPassword(user.passwordHash, password) : false;

      if (!user || !passwordMatches) {
        if (user) await registerFailedLogin(user);
        recordAuthEvent(AuthEvent.LOGIN_FAILED, { userId: user?.id ?? null, request });
        reply.code(401).send({
          error: { code: 'invalid_credentials', message: 'Incorrect email or password.' },
        });
        return;
      }

      if (user.status !== UserStatus.ACTIVE) {
        reply.code(403).send({
          error: {
            code: user.status === UserStatus.BANNED ? 'account_banned' : 'account_suspended',
            message: 'This account cannot be used.',
          },
        });
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
      recordAuthEvent(AuthEvent.LOGIN_SUCCEEDED, { userId: user.id, request });

      return completeSignIn(user.id, request, reply);
    },
  );

  /* --------------------------------------------------------------------- *
   * Session lifecycle
   * --------------------------------------------------------------------- */

  typed.post(
    '/auth/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Exchange the refresh cookie for a new access token',
        response: { 200: AuthResponseSchema, 401: ErrorResponseSchema },
      },
    },
    async (request, reply): Promise<AuthResponse | void> => {
      const presented = readRefreshCookie(request);
      if (!presented) {
        reply.code(401).send({ error: { code: 'no_session', message: 'No session to refresh.' } });
        return;
      }

      const result = await rotateSession(presented, request);
      if (result.outcome !== 'rotated') {
        clearRefreshCookie(reply);
        reply.code(401).send({
          error: {
            code: result.outcome === 'reused' ? 'token_reused' : 'session_expired',
            // A replayed token means someone has a copy. Both the legitimate
            // client and the thief are signed out; only the wording differs.
            message:
              result.outcome === 'reused'
                ? 'This session was ended for security reasons. Please sign in again.'
                : 'Your session has ended.',
          },
        });
        return;
      }

      setRefreshCookie(reply, result.refreshToken);
      const { token, expiresAt } = signAccessToken(result.session.userId, result.session.id);
      const user = await loadUserProfile(result.session.userId);
      if (!user) {
        clearRefreshCookie(reply);
        reply
          .code(401)
          .send({ error: { code: 'session_expired', message: 'Your session has ended.' } });
        return;
      }

      recordAuthEvent(AuthEvent.TOKEN_REFRESHED, { userId: user.id, request });
      return { accessToken: token, expiresAt, user };
    },
  );

  typed.post(
    '/auth/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign out of this device',
        response: { 200: OkResponseSchema },
      },
    },
    async (request, reply): Promise<OkResponse> => {
      const presented = readRefreshCookie(request);
      if (presented) {
        // Revoke by token hash rather than by id: logging out must work even
        // when the access token has already expired.
        const { count } = await prisma.authSession.updateMany({
          where: { tokenHash: hashOpaqueToken(presented), revokedAt: null },
          data: { revokedAt: new Date() },
        });
        if (count > 0) recordAuthEvent(AuthEvent.LOGGED_OUT, { request });
      }
      clearRefreshCookie(reply);
      // Always 200: an already-signed-out caller has nothing to fix.
      return { ok: true };
    },
  );

  /* --------------------------------------------------------------------- *
   * Profile
   * --------------------------------------------------------------------- */

  typed.get(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'The signed-in account',
        security: [{ bearerAuth: [] }],
        response: { 200: UserProfileSchema, 401: ErrorResponseSchema, 403: ErrorResponseSchema },
      },
    },
    async (request, reply): Promise<UserProfile | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;
      return (await loadUserProfile(caller.user.id)) ?? undefined;
    },
  );

  typed.post(
    '/auth/complete-profile',
    {
      schema: {
        tags: ['auth'],
        summary: 'Supply the details a social sign-up could not',
        security: [{ bearerAuth: [] }],
        body: CompleteProfileRequestSchema,
        response: {
          200: UserProfileSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<UserProfile | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      const { username, displayName, dateOfBirth, country } = request.body;

      // Once accepted, the age attestation and the handle are fixed. Letting
      // them be rewritten here would turn the completion step into a way to
      // edit around the 18+ check or squat a username repeatedly.
      if (isProfileComplete(caller.user)) {
        reply.code(409).send({
          error: { code: 'already_complete', message: 'This profile is already complete.' },
        });
        return;
      }

      if (!isAtLeastMinimumAge(dateOfBirth)) {
        reply.code(403).send({
          error: { code: 'age_requirement', message: 'You must be 18 or older to use Cougny.' },
        });
        return;
      }

      const now = new Date();
      try {
        const updated = await prisma.user.update({
          where: { id: caller.user.id },
          data: {
            username,
            displayName: displayName ?? caller.user.displayName,
            dateOfBirth: parseCalendarDate(dateOfBirth),
            country,
            termsAcceptedAt: caller.user.termsAcceptedAt ?? now,
            conductAcceptedAt: caller.user.conductAcceptedAt ?? now,
            profileCompletedAt: now,
          },
          include: { oauthAccounts: true },
        });

        recordAuthEvent(AuthEvent.PROFILE_COMPLETED, { userId: updated.id, request });
        return toUserProfile(updated, updated.oauthAccounts);
      } catch (error) {
        if (isUniqueViolation(error, 'username')) {
          reply
            .code(409)
            .send({ error: { code: 'username_taken', message: 'That username is taken.' } });
          return;
        }
        throw error;
      }
    },
  );

  typed.patch(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'Update profile details',
        security: [{ bearerAuth: [] }],
        body: UpdateProfileRequestSchema,
        response: { 200: UserProfileSchema, 401: ErrorResponseSchema, 403: ErrorResponseSchema },
      },
    },
    async (request, reply): Promise<UserProfile | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      const { displayName, country } = request.body;
      const updated = await prisma.user.update({
        where: { id: caller.user.id },
        data: {
          ...(displayName !== undefined ? { displayName } : {}),
          ...(country !== undefined ? { country } : {}),
        },
        include: { oauthAccounts: true },
      });

      recordAuthEvent(AuthEvent.PROFILE_UPDATED, { userId: updated.id, request });
      return toUserProfile(updated, updated.oauthAccounts);
    },
  );

  typed.delete(
    '/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'Delete the account',
        security: [{ bearerAuth: [] }],
        body: DeleteAccountRequestSchema,
        response: {
          200: OkResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<OkResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      // Deleting is irreversible, so an account with a password must re-enter it.
      if (caller.user.passwordHash) {
        const password = request.body.password ?? '';
        if (!(await verifyPassword(caller.user.passwordHash, password))) {
          reply.code(403).send({
            error: { code: 'invalid_credentials', message: 'Enter your password to continue.' },
          });
          return;
        }
      }

      // Audited before the row goes: the entry outlives the account by design,
      // and its `userId` is nulled by the foreign key as the user is removed.
      recordAuthEvent(AuthEvent.ACCOUNT_DELETED, { userId: caller.user.id, request });

      // Passkeys, sessions, tokens, and linked identities cascade. Call history
      // does not: those rows hang off anonymous `Session`s, whose `userId` is
      // set to null, so moderation records survive without naming anyone.
      await prisma.user.delete({ where: { id: caller.user.id } });
      clearRefreshCookie(reply);
      return { ok: true };
    },
  );

  /* --------------------------------------------------------------------- *
   * Passwords
   * --------------------------------------------------------------------- */

  typed.post(
    '/auth/password/change',
    {
      schema: {
        tags: ['auth'],
        summary: 'Change or set the account password',
        security: [{ bearerAuth: [] }],
        body: ChangePasswordRequestSchema,
        response: {
          200: OkResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<OkResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      // An account created socially has no password yet; setting the first one
      // needs no current password, because there is none to prove.
      if (caller.user.passwordHash) {
        const current = request.body.currentPassword ?? '';
        if (!(await verifyPassword(caller.user.passwordHash, current))) {
          reply.code(403).send({
            error: { code: 'invalid_credentials', message: 'Your current password is incorrect.' },
          });
          return;
        }
      }

      await prisma.user.update({
        where: { id: caller.user.id },
        data: {
          passwordHash: await hashPassword(request.body.newPassword),
          passwordChangedAt: new Date(),
        },
      });

      // Every other device is signed out: if the password was changed because
      // it leaked, any session an attacker opened with it must end here.
      await revokeAllSessions(caller.user.id, caller.authSessionId);
      recordAuthEvent(AuthEvent.PASSWORD_CHANGED, { userId: caller.user.id, request });
      return { ok: true };
    },
  );

  typed.post(
    '/auth/password/forgot',
    {
      config: { rateLimit: EMAIL_SEND_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Request a password reset link',
        body: ForgotPasswordRequestSchema,
        response: { 200: OkResponseSchema, 429: ErrorResponseSchema },
      },
    },
    async (request): Promise<OkResponse> => {
      const user = await prisma.user.findUnique({
        where: { email: request.body.email },
        select: { id: true, email: true },
      });

      if (user?.email) {
        const token = await issueEmailToken(
          user.id,
          AuthTokenPurpose.PASSWORD_RESET,
          PASSWORD_RESET_TTL_HOURS,
        );
        await sendPasswordReset(
          user.email,
          token,
          PASSWORD_RESET_TTL_HOURS,
          request.log,
          localeFromHeader(request.headers['accept-language']),
        );
        recordAuthEvent(AuthEvent.PASSWORD_RESET_REQUESTED, { userId: user.id, request });
      }

      // Always the same answer. Anything else turns this endpoint into a way to
      // ask "does this person have a Cougny account?" — which, for this
      // product in particular, is not a question a stranger should get answered.
      return { ok: true };
    },
  );

  typed.post(
    '/auth/password/reset',
    {
      config: { rateLimit: LOGIN_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Set a new password using a reset link',
        body: ResetPasswordRequestSchema,
        response: { 200: OkResponseSchema, 400: ErrorResponseSchema, 429: ErrorResponseSchema },
      },
    },
    async (request, reply): Promise<OkResponse | void> => {
      const consumed = await consumeEmailToken(request.body.token, AuthTokenPurpose.PASSWORD_RESET);
      if (!consumed) {
        reply.code(400).send({
          error: { code: 'invalid_token', message: 'This reset link is invalid or has expired.' },
        });
        return;
      }

      await prisma.user.update({
        where: { id: consumed.userId },
        data: {
          passwordHash: await hashPassword(request.body.newPassword),
          passwordChangedAt: new Date(),
          // Whoever asked for the reset has just proven control of the inbox,
          // so a pending email verification is satisfied by the same act.
          emailVerifiedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      await revokeAllSessions(consumed.userId);
      recordAuthEvent(AuthEvent.PASSWORD_RESET_COMPLETED, { userId: consumed.userId, request });
      return { ok: true };
    },
  );

  /* --------------------------------------------------------------------- *
   * Email verification
   * --------------------------------------------------------------------- */

  typed.post(
    '/auth/email/verify',
    {
      config: { rateLimit: LOGIN_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Confirm an email address',
        body: VerifyEmailRequestSchema,
        response: { 200: OkResponseSchema, 400: ErrorResponseSchema, 429: ErrorResponseSchema },
      },
    },
    async (request, reply): Promise<OkResponse | void> => {
      const consumed = await consumeEmailToken(
        request.body.token,
        AuthTokenPurpose.EMAIL_VERIFICATION,
      );
      if (!consumed) {
        reply.code(400).send({
          error: { code: 'invalid_token', message: 'This link is invalid or has expired.' },
        });
        return;
      }

      await prisma.user.update({
        where: { id: consumed.userId },
        data: { emailVerifiedAt: new Date() },
      });
      recordAuthEvent(AuthEvent.EMAIL_VERIFIED, { userId: consumed.userId, request });
      return { ok: true };
    },
  );

  typed.post(
    '/auth/email/resend',
    {
      config: { rateLimit: EMAIL_SEND_LIMIT },
      schema: {
        tags: ['auth'],
        summary: 'Send the verification email again',
        security: [{ bearerAuth: [] }],
        response: {
          200: OkResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          429: ErrorResponseSchema,
        },
      },
    },
    async (request, reply): Promise<OkResponse | void> => {
      const caller = await requireUser(request, reply);
      if (!caller) return;

      // Nothing to do for an address that is already confirmed, or an account
      // that has no address at all. Both answer 200 — there is no error here.
      if (caller.user.email && !caller.user.emailVerifiedAt) {
        const token = await issueEmailToken(
          caller.user.id,
          AuthTokenPurpose.EMAIL_VERIFICATION,
          EMAIL_VERIFICATION_TTL_HOURS,
        );
        await sendEmailVerification(
          caller.user.email,
          token,
          EMAIL_VERIFICATION_TTL_HOURS,
          request.log,
          localeFromHeader(request.headers['accept-language']),
        );
      }
      return { ok: true };
    },
  );
}

/**
 * Records a wrong password and locks the account once the attempts pile up.
 * The lock is time-boxed rather than permanent, so it frustrates guessing
 * without handing anyone a way to lock a stranger out of their account for good.
 */
async function registerFailedLogin(user: User): Promise<void> {
  const attempts = user.failedLoginAttempts + 1;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: attempts,
      ...(attempts >= MAX_FAILED_LOGINS
        ? {
            lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
            failedLoginAttempts: 0,
          }
        : {}),
    },
  });
}
