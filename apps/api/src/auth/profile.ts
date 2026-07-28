import {
  prisma,
  OAuthProvider,
  UserRole,
  UserStatus,
  type OAuthAccount,
  type User,
} from '@cougny/db';
import {
  toCalendarDateString,
  type AccountRole,
  type AccountStatus,
  type OAuthProvider as WireProvider,
  type UserProfile,
} from '@cougny/protocol';

/**
 * Translation between the database's SCREAMING_CASE enums and the wire's
 * lowercase ones. Kept explicit rather than lowercasing on the fly so adding a
 * value to either side fails to compile until both are updated.
 */
const ROLES: Record<UserRole, AccountRole> = {
  [UserRole.USER]: 'user',
  [UserRole.MODERATOR]: 'moderator',
  [UserRole.ADMIN]: 'admin',
};

const STATUSES: Record<UserStatus, AccountStatus> = {
  [UserStatus.ACTIVE]: 'active',
  [UserStatus.SUSPENDED]: 'suspended',
  [UserStatus.BANNED]: 'banned',
};

export const WIRE_TO_DB_PROVIDER: Record<WireProvider, OAuthProvider> = {
  google: OAuthProvider.GOOGLE,
  discord: OAuthProvider.DISCORD,
};

const DB_TO_WIRE_PROVIDER: Record<OAuthProvider, WireProvider> = {
  [OAuthProvider.GOOGLE]: 'google',
  [OAuthProvider.DISCORD]: 'discord',
};

/**
 * A social sign-up arrives without the things Cougny is required to know: an
 * age that clears the 18+ bar, a country, and a recorded acceptance of the
 * terms. Until all three are on file the account exists but is not yet usable,
 * and the client routes its holder to the completion step.
 */
export function isProfileComplete(user: User): boolean {
  return Boolean(user.profileCompletedAt && user.dateOfBirth && user.country && user.username);
}

/**
 * Serializes an account for its own holder. Everything here is self-visible
 * only — email and date of birth in particular are never exposed to peers.
 */
export function toUserProfile(user: User, oauthAccounts: OAuthAccount[]): UserProfile {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    country: user.country,
    dateOfBirth: user.dateOfBirth ? toCalendarDateString(user.dateOfBirth) : null,
    role: ROLES[user.role],
    status: STATUSES[user.status],
    profileComplete: isProfileComplete(user),
    hasPassword: user.passwordHash !== null,
    linkedAccounts: oauthAccounts.map((account) => ({
      provider: DB_TO_WIRE_PROVIDER[account.provider],
      label: account.label,
      linkedAt: account.createdAt.toISOString(),
    })),
    createdAt: user.createdAt.toISOString(),
  };
}

/** Loads an account and its linked identities, ready to serialize. */
export async function loadUserProfile(userId: string): Promise<UserProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { oauthAccounts: { orderBy: { createdAt: 'asc' } } },
  });
  return user ? toUserProfile(user, user.oauthAccounts) : null;
}
