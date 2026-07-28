import { vi } from 'vitest';

/**
 * Stand-in for `@cougny/db` used by route tests.
 *
 * The real package instantiates a Prisma client the moment it is imported, so
 * tests that only need to exercise HTTP behaviour replace it wholesale rather
 * than talking to a database. It lives here instead of being repeated in each
 * test file because every route module the app registers is imported at
 * startup — so a mock that omits an enum one route reads at module scope breaks
 * unrelated suites.
 *
 * Usage, at the top of a test file:
 *
 * ```ts
 * vi.mock('@cougny/db', () => createDbDouble());
 * ```
 *
 * Override individual methods by passing them in; the merge is per-method, so
 * naming one method of a model keeps the rest of that model's defaults. Anything
 * not overridden is a bare `vi.fn()` that resolves to undefined.
 */
export function createDbDouble(overrides: DbDoubleOverrides = {}): Record<string, unknown> {
  const base: { prisma: Record<string, unknown>; [key: string]: unknown } = {
    prisma: {
      session: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
      call: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      report: { create: vi.fn() },
      user: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      authSession: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      authToken: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
      authAuditLog: { create: vi.fn().mockResolvedValue({}) },
      oAuthAccount: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        deleteMany: vi.fn(),
      },
      passkey: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },

    // Enums are read at module scope by the route files, so they must all be
    // present even for suites that never touch the corresponding tables.
    ReportReason: {
      NUDITY: 'NUDITY',
      HARASSMENT: 'HARASSMENT',
      MINOR: 'MINOR',
      SPAM: 'SPAM',
      OTHER: 'OTHER',
    },
    ReportStatus: {
      OPEN: 'OPEN',
      REVIEWING: 'REVIEWING',
      ACTIONED: 'ACTIONED',
      DISMISSED: 'DISMISSED',
    },
    CallEndReason: {
      SKIPPED: 'SKIPPED',
      DISCONNECTED: 'DISCONNECTED',
      REPORTED: 'REPORTED',
      ERROR: 'ERROR',
    },
    UserRole: { USER: 'USER', MODERATOR: 'MODERATOR', ADMIN: 'ADMIN' },
    UserStatus: { ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED', BANNED: 'BANNED' },
    OAuthProvider: { GOOGLE: 'GOOGLE', DISCORD: 'DISCORD' },
    AuthTokenPurpose: {
      EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
      PASSWORD_RESET: 'PASSWORD_RESET',
    },
    AuthEvent: {
      REGISTERED: 'REGISTERED',
      LOGIN_SUCCEEDED: 'LOGIN_SUCCEEDED',
      LOGIN_FAILED: 'LOGIN_FAILED',
      LOGGED_OUT: 'LOGGED_OUT',
      TOKEN_REFRESHED: 'TOKEN_REFRESHED',
      TOKEN_REUSE_DETECTED: 'TOKEN_REUSE_DETECTED',
      PASSWORD_CHANGED: 'PASSWORD_CHANGED',
      PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
      PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
      EMAIL_VERIFIED: 'EMAIL_VERIFIED',
      PROFILE_COMPLETED: 'PROFILE_COMPLETED',
      PROFILE_UPDATED: 'PROFILE_UPDATED',
      OAUTH_LINKED: 'OAUTH_LINKED',
      OAUTH_UNLINKED: 'OAUTH_UNLINKED',
      PASSKEY_REGISTERED: 'PASSKEY_REGISTERED',
      PASSKEY_REMOVED: 'PASSKEY_REMOVED',
      PASSKEY_LOGIN_SUCCEEDED: 'PASSKEY_LOGIN_SUCCEEDED',
      SESSION_REVOKED: 'SESSION_REVOKED',
      ACCOUNT_DELETED: 'ACCOUNT_DELETED',
    },

    /**
     * Only the error class the route code narrows on. Constructed with a `code`
     * so `isUniqueViolation` can recognize a simulated constraint failure.
     */
    Prisma: {
      PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
        code: string;
        meta?: { target?: string[] };
        constructor(message: string, options: { code: string; meta?: { target?: string[] } }) {
          super(message);
          this.code = options.code;
          this.meta = options.meta;
        }
      },
    },
  };

  for (const [key, override] of Object.entries(overrides.prisma ?? {})) {
    const existing = base.prisma[key];
    // Models merge method-by-method; `$transaction` is a function, so it is
    // replaced outright rather than spread into an empty object.
    base.prisma[key] =
      typeof override === 'object' && override !== null && typeof existing === 'object'
        ? { ...(existing as Record<string, unknown>), ...(override as Record<string, unknown>) }
        : override;
  }

  return base;
}

/**
 * Overrides accepted by {@link createDbDouble}: `{ prisma: { model: { method } } }`.
 * `$transaction` is a function rather than a model, so it is named separately.
 */
export interface DbDoubleOverrides {
  prisma?: Record<string, Record<string, unknown> | unknown>;
}
