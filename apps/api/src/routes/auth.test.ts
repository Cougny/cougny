import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createDbDouble } from '../test/db-double.js';

const userCreate = vi.fn();
const userFindUnique = vi.fn();
const userUpdate = vi.fn();
const authSessionCreate = vi.fn();
const authSessionFindFirst = vi.fn();
const authSessionFindUnique = vi.fn();
const authSessionUpdate = vi.fn();
const authSessionUpdateMany = vi.fn();
const auditLogCreate = vi.fn();
const transaction = vi.fn();

vi.mock('@cougny/db', () =>
  createDbDouble({
    prisma: {
      user: { create: userCreate, findUnique: userFindUnique, update: userUpdate },
      authSession: {
        create: authSessionCreate,
        findFirst: authSessionFindFirst,
        findUnique: authSessionFindUnique,
        update: authSessionUpdate,
        updateMany: authSessionUpdateMany,
      },
      authAuditLog: { create: auditLogCreate },
      $transaction: transaction,
    },
  }),
);

/** A fully set-up, active account with a password. */
function accountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'ada@example.com',
    emailVerifiedAt: null,
    passwordHash: null,
    passwordChangedAt: null,
    username: 'ada',
    displayName: 'Ada',
    avatarUrl: null,
    dateOfBirth: new Date('1990-06-15T00:00:00Z'),
    country: 'GB',
    role: 'USER',
    status: 'ACTIVE',
    termsAcceptedAt: new Date(),
    profileCompletedAt: new Date(),
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    oauthAccounts: [],
    ...overrides,
  };
}

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'auth-session-1',
    userId: 'user-1',
    tokenHash: 'hash',
    familyId: 'family-1',
    createdAt: new Date(),
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    ipHash: null,
    userAgent: null,
    ...overrides,
  };
}

describe('account routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_JWT_SECRET = 'test-secret-at-least-16-chars';
    process.env.TURN_STATIC_AUTH_SECRET = 'test-turn-secret';

    const { buildApp } = await import('../app.js');
    app = await buildApp();
  });

  beforeEach(() => {
    // `resetAllMocks`, not `clearAllMocks`: a `mockResolvedValueOnce` queued by
    // a test that never consumed it would otherwise leak into the next one and
    // shift every subsequent answer by one.
    vi.resetAllMocks();
    authSessionCreate.mockResolvedValue(sessionRow());
    authSessionUpdate.mockResolvedValue(sessionRow());
    userUpdate.mockResolvedValue(accountRow());
    transaction.mockResolvedValue([{}, sessionRow()]);
    // The audit trail is written fire-and-forget, so its result is chained onto
    // directly; it has to resolve rather than return undefined.
    auditLogCreate.mockResolvedValue({});
  });

  /**
   * The auth routes are rate-limited per IP, and `inject` reuses one address by
   * default — enough tests in a row would start seeing 429s that have nothing to
   * do with what they are asserting. Each request gets its own source address.
   */
  let nextAddress = 0;
  const from = (): string => `10.0.${Math.floor(nextAddress / 256)}.${nextAddress++ % 256}`;

  const register = (body: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      body,
      remoteAddress: from(),
    });

  const validRegistration = {
    email: 'ada@example.com',
    password: 'correct horse battery staple',
    username: 'ada',
    dateOfBirth: '1990-06-15',
    country: 'GB',
    acceptedTerms: true,
    acceptedConduct: true,
  };

  describe('POST /v1/auth/register', () => {
    it('creates an account and returns an access token', async () => {
      userCreate.mockResolvedValueOnce(accountRow());
      userFindUnique.mockResolvedValueOnce(accountRow());

      const res = await register(validRegistration);

      expect(res.statusCode, res.body).toBe(201);
      const body = res.json();
      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user.email).toBe('ada@example.com');
      expect(body.user.profileComplete).toBe(true);
    });

    it('puts the refresh token in an httpOnly cookie, never the body', async () => {
      userCreate.mockResolvedValueOnce(accountRow());
      userFindUnique.mockResolvedValueOnce(accountRow());

      const res = await register(validRegistration);

      const cookie = res.cookies.find((c) => c.name === 'cougny.refresh');
      expect(cookie).toBeDefined();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.path).toBe('/v1/auth');
      expect(res.body).not.toContain(cookie!.value);
    });

    it('refuses an under-18 date of birth', async () => {
      const thisYear = new Date().getUTCFullYear();
      const res = await register({ ...validRegistration, dateOfBirth: `${thisYear - 15}-01-01` });

      expect(res.statusCode).toBe(400);
      expect(userCreate).not.toHaveBeenCalled();
    });

    it('refuses a country that is not UN-recognized', async () => {
      const res = await register({ ...validRegistration, country: 'XK' });

      expect(res.statusCode).toBe(400);
      expect(userCreate).not.toHaveBeenCalled();
    });

    it('refuses a registration that does not accept the terms', async () => {
      const res = await register({ ...validRegistration, acceptedTerms: false });

      expect(res.statusCode).toBe(400);
      expect(userCreate).not.toHaveBeenCalled();
    });

    it('refuses a registration that does not accept the content rules', async () => {
      const res = await register({ ...validRegistration, acceptedConduct: false });

      expect(res.statusCode).toBe(400);
      expect(userCreate).not.toHaveBeenCalled();
    });

    it('records both attestations with a timestamp', async () => {
      userCreate.mockResolvedValueOnce(accountRow());
      userFindUnique.mockResolvedValueOnce(accountRow());

      await register(validRegistration);

      const written = userCreate.mock.calls[0]?.[0].data as {
        termsAcceptedAt: Date;
        conductAcceptedAt: Date;
      };
      expect(written.termsAcceptedAt).toBeInstanceOf(Date);
      expect(written.conductAcceptedAt).toBeInstanceOf(Date);
    });

    it('stores the password hashed, never in the clear', async () => {
      userCreate.mockResolvedValueOnce(accountRow());
      userFindUnique.mockResolvedValueOnce(accountRow());

      await register(validRegistration);

      const written = userCreate.mock.calls[0]?.[0].data as { passwordHash: string };
      expect(written.passwordHash).toMatch(/^\$argon2id\$/);
      expect(written.passwordHash).not.toContain(validRegistration.password);
    });

    /**
     * The two shapes a P2002 can arrive in. `meta.target` is what the classic
     * query engine sets; `driverAdapterError` is what this service actually
     * sees, because it connects through node-postgres. Both are exercised so a
     * change of shape cannot quietly turn a 409 back into a 500.
     */
    const uniqueViolations = {
      'the classic engine shape': { target: ['email'] },
      'the driver-adapter shape': {
        modelName: 'User',
        driverAdapterError: {
          name: 'DriverAdapterError',
          cause: {
            originalCode: '23505',
            kind: 'UniqueConstraintViolation',
            constraint: { fields: ['email'] },
          },
        },
      },
      'a constraint reported only by name': {
        driverAdapterError: {
          cause: { constraint: { index: 'User_email_key' } },
        },
      },
    };

    for (const [shape, meta] of Object.entries(uniqueViolations)) {
      it(`reports a duplicate email as a conflict, given ${shape}`, async () => {
        const { Prisma } = (await import('@cougny/db')) as unknown as {
          Prisma: {
            PrismaClientKnownRequestError: new (
              message: string,
              options: { code: string; meta?: Record<string, unknown> },
            ) => Error;
          };
        };
        userCreate.mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', meta }),
        );

        const res = await register(validRegistration);

        expect(res.statusCode).toBe(409);
        expect(res.json().error.code).toBe('email_taken');
      });
    }
  });

  describe('POST /v1/auth/login', () => {
    it('rejects an unknown email with the generic message', async () => {
      userFindUnique.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        body: { email: 'nobody@example.com', password: 'whatever-long-enough' },
        remoteAddress: from(),
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('invalid_credentials');
    });

    it('rejects a wrong password with the same message as an unknown email', async () => {
      const { hashPassword } = await import('../auth/passwords.js');
      userFindUnique.mockResolvedValueOnce(
        accountRow({ passwordHash: await hashPassword('the-real-password') }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        body: { email: 'ada@example.com', password: 'not-the-password' },
        remoteAddress: from(),
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('invalid_credentials');
    });

    it('signs in with the correct password', async () => {
      const { hashPassword } = await import('../auth/passwords.js');
      const row = accountRow({ passwordHash: await hashPassword('the-real-password') });
      userFindUnique.mockResolvedValueOnce(row).mockResolvedValueOnce(row);

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        body: { email: 'ada@example.com', password: 'the-real-password' },
        remoteAddress: from(),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().user.id).toBe('user-1');
    });

    it('refuses a banned account even with the right password', async () => {
      const { hashPassword } = await import('../auth/passwords.js');
      userFindUnique.mockResolvedValueOnce(
        accountRow({ passwordHash: await hashPassword('the-real-password'), status: 'BANNED' }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        body: { email: 'ada@example.com', password: 'the-real-password' },
        remoteAddress: from(),
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('account_banned');
    });

    it('refuses a locked-out account without checking the password', async () => {
      const { hashPassword } = await import('../auth/passwords.js');
      userFindUnique.mockResolvedValueOnce(
        accountRow({
          passwordHash: await hashPassword('the-real-password'),
          lockedUntil: new Date(Date.now() + 60_000),
        }),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        body: { email: 'ada@example.com', password: 'the-real-password' },
        remoteAddress: from(),
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /v1/auth/password/forgot', () => {
    it('answers identically for a registered and an unregistered address', async () => {
      userFindUnique.mockResolvedValueOnce(null);
      const unknown = await app.inject({
        method: 'POST',
        url: '/v1/auth/password/forgot',
        body: { email: 'nobody@example.com' },
        remoteAddress: from(),
      });

      userFindUnique.mockResolvedValueOnce({ id: 'user-1', email: 'ada@example.com' });
      transaction.mockResolvedValueOnce([{}, {}]);
      const known = await app.inject({
        method: 'POST',
        url: '/v1/auth/password/forgot',
        body: { email: 'ada@example.com' },
        remoteAddress: from(),
      });

      expect(unknown.statusCode).toBe(known.statusCode);
      expect(unknown.body).toBe(known.body);
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('401s when no refresh cookie is present', async () => {
      const res = await app.inject({ method: 'POST', url: '/v1/auth/refresh' });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('no_session');
    });

    it('revokes the whole family when an already-spent token is replayed', async () => {
      authSessionFindUnique.mockResolvedValueOnce(
        sessionRow({ revokedAt: new Date(), familyId: 'family-7' }),
      );
      authSessionUpdateMany.mockResolvedValueOnce({ count: 2 });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: { 'cougny.refresh': 'a-stolen-token' },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('token_reused');
      expect(authSessionUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ familyId: 'family-7' }) }),
      );
    });

    it('rotates a valid token and clears nothing', async () => {
      authSessionFindUnique.mockResolvedValueOnce(sessionRow());
      transaction.mockResolvedValueOnce([{}, sessionRow({ id: 'auth-session-2' })]);
      userFindUnique.mockResolvedValueOnce(accountRow());

      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: { 'cougny.refresh': 'a-valid-token' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().accessToken).toEqual(expect.any(String));
      expect(res.cookies.find((c) => c.name === 'cougny.refresh')?.value).not.toBe('a-valid-token');
    });
  });

  describe('authorization', () => {
    it('rejects /auth/me without a token', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/auth/me' });
      expect(res.statusCode).toBe(401);
    });

    it('does not accept an anonymous call-session token as an account token', async () => {
      // Both token kinds are signed from AUTH_JWT_SECRET, but with keys derived
      // for different purposes — this is the check that separation is real.
      const { signSessionToken } = await import('../tokens.js');
      const anonymous = signSessionToken('session-a').token;

      const res = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: { authorization: `Bearer ${anonymous}` },
      });

      expect(res.statusCode).toBe(401);
    });

    it('rejects an access token whose session has been revoked', async () => {
      const { signAccessToken } = await import('../auth/tokens.js');
      const { token } = signAccessToken('user-1', 'auth-session-1');
      // The guard filters revoked sessions out in the query itself, so a
      // revoked one simply does not come back.
      authSessionFindFirst.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('session_expired');
    });

    it('serves the profile for a live session', async () => {
      const { signAccessToken } = await import('../auth/tokens.js');
      const { token } = signAccessToken('user-1', 'auth-session-1');
      authSessionFindFirst.mockResolvedValueOnce({ ...sessionRow(), user: accountRow() });
      userFindUnique.mockResolvedValueOnce(accountRow());

      const res = await app.inject({
        method: 'GET',
        url: '/v1/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: 'user-1', username: 'ada', profileComplete: true });
    });
  });

  describe('error envelope', () => {
    it('reports a validation failure as a 400 in the standard envelope', async () => {
      // This route documents a 400, so the reply is serialized against
      // `ErrorResponseSchema` — a validation error in any other shape would
      // fail to serialize and surface as a 500.
      const res = await app.inject({
        method: 'POST',
        url: '/v1/auth/email/verify',
        body: { token: '' },
        remoteAddress: from(),
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({
        error: { code: 'invalid_request', message: expect.any(String) },
      });
    });

    it('does not leak internals when a handler throws', async () => {
      userCreate.mockRejectedValueOnce(
        new Error('connect ECONNREFUSED 10.0.0.5:5432 while running `prisma.user.create()`'),
      );

      const res = await register(validRegistration);

      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({
        error: { code: 'internal_error', message: 'Something went wrong.' },
      });
      expect(res.body).not.toContain('ECONNREFUSED');
      expect(res.body).not.toContain('prisma');
    });
  });

  describe('GET /v1/auth/capabilities', () => {
    it('offers no social providers when none are configured', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/auth/capabilities' });

      expect(res.statusCode).toBe(200);
      expect(res.json().oauthProviders).toEqual([]);
    });
  });
});
