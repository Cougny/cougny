import { z } from 'zod';
import { CountryCodeSchema } from './countries.js';

/**
 * Shared account/authentication contracts for `apps/api` and `apps/web`.
 *
 * An account is required to call: it carries the 18+ attestation and the
 * agreement to the content rules, and it gives moderation something durable to
 * act on. It can be created with an email/password pair or through a social
 * provider, and once it exists a passkey can be added as a way back in.
 *
 * Peers still never see each other's account — see `CreateSessionResponse` in
 * `rest.ts` for the pseudonymous identity a call actually runs on.
 */

/** Minimum age, in years, required to hold a Cougny account. */
export const MINIMUM_AGE_YEARS = 18;

/** Social identity providers Cougny can create or link an account with. */
export const OAUTH_PROVIDERS = ['google', 'discord'] as const;
export const OAuthProviderSchema = z.enum(OAUTH_PROVIDERS);
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;

/* ------------------------------------------------------------------------- *
 * Field primitives
 * ------------------------------------------------------------------------- */

/**
 * Emails are stored lowercase so `A@b.com` and `a@b.com` can never become two
 * accounts. The length ceiling matches the practical SMTP limit.
 */
export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

/**
 * Password policy: length is the only requirement that meaningfully resists
 * offline cracking, so we ask for length rather than composition classes (per
 * current NIST guidance). The ceiling bounds the hashing work an unauthenticated
 * caller can force us to do.
 */
export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(200, 'Password must be at most 200 characters.');

/**
 * Public handle. Lowercase-normalized so `Ada` and `ada` collide, which is what
 * users expect from a name they might type to find someone.
 */
export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(20)
  .regex(/^[a-z0-9_]+$/, 'Use letters, numbers, and underscores only.');

/** Free-form name shown to other people; optional and never unique. */
export const DisplayNameSchema = z.string().trim().min(1).max(40);

/**
 * Date of birth as a calendar date (`YYYY-MM-DD`), not an instant — a birthday
 * has no timezone. Validated for real-calendar existence so `2001-02-30` is
 * rejected rather than silently rolled over to March.
 */
export const DateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD.')
  .refine((value) => parseCalendarDate(value) !== null, 'Not a real calendar date.')
  .refine(
    (value) => isAtLeastMinimumAge(value),
    `You must be at least ${MINIMUM_AGE_YEARS} years old.`,
  );

/**
 * Explicit, recorded agreement to the terms. Modeled as a literal `true` so a
 * client cannot register by omitting the field or sending `false`.
 */
export const TermsAcceptanceSchema = z.literal(true, {
  message: 'You must accept the terms to create an account.',
});

/**
 * Separate acknowledgement of the content rules — no CSAM, no exploitation, no
 * illegal material. Kept apart from the general terms, and recorded with its
 * own timestamp, because for this product it is the attestation that actually
 * matters if an account is ever the subject of a report or a legal request.
 */
export const ConductAcceptanceSchema = z.literal(true, {
  message: 'You must agree to the content rules to create an account.',
});

/* ------------------------------------------------------------------------- *
 * Age helpers — shared so the browser preview and the server verdict agree
 * ------------------------------------------------------------------------- */

/**
 * Parses `YYYY-MM-DD` into a UTC-midnight Date, returning null when the string
 * does not name a real date. `Date.UTC` rolls overflow over silently
 * (`2001-02-30` becomes March 2), so the components are compared back out.
 */
export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return roundTrips ? date : null;
}

/** Whole years elapsed between a date of birth and `now`. Negative if unborn. */
export function calculateAge(dateOfBirth: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  const beforeBirthdayThisYear =
    monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthdayThisYear) age -= 1;
  return age;
}

/**
 * The single 18+ gate. Both the sign-up form and every server-side write route
 * call this, so the rule can never be enforced in one place and not the other.
 */
export function isAtLeastMinimumAge(dateOfBirth: string | Date, now: Date = new Date()): boolean {
  const date = typeof dateOfBirth === 'string' ? parseCalendarDate(dateOfBirth) : dateOfBirth;
  if (!date) return false;
  if (date.getTime() > now.getTime()) return false;
  return calculateAge(date, now) >= MINIMUM_AGE_YEARS;
}

/** Formats a Date as the `YYYY-MM-DD` string the wire format uses. */
export function toCalendarDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------------- *
 * Account state
 * ------------------------------------------------------------------------- */

export const AccountStatusSchema = z.enum(['active', 'suspended', 'banned']);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const AccountRoleSchema = z.enum(['user', 'moderator', 'admin']);
export type AccountRole = z.infer<typeof AccountRoleSchema>;

/** A social identity linked to the account, as shown on the security screen. */
export const LinkedAccountSchema = z.object({
  provider: OAuthProviderSchema,
  /** The handle or email the provider reported, for recognizability. */
  label: z.string().nullable(),
  linkedAt: z.string(),
});
export type LinkedAccount = z.infer<typeof LinkedAccountSchema>;

/**
 * The signed-in user's own profile. Contains fields no one else may see
 * (email, date of birth); peer-visible data is a strict subset of this.
 */
export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  country: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  role: AccountRoleSchema,
  status: AccountStatusSchema,
  /**
   * False while a social sign-up still owes us the details its provider cannot
   * supply — date of birth, country, and terms acceptance. The client routes
   * such users to the completion step instead of the app.
   */
  profileComplete: z.boolean(),
  hasPassword: z.boolean(),
  linkedAccounts: z.array(LinkedAccountSchema),
  createdAt: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * What a successful authentication returns. The refresh token is deliberately
 * absent: it is set as an httpOnly cookie so client JavaScript — and anything
 * that manages to run in the page — can never read it.
 */
export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.number().int(),
  user: UserProfileSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/* ------------------------------------------------------------------------- *
 * Requests
 * ------------------------------------------------------------------------- */

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  username: UsernameSchema,
  displayName: DisplayNameSchema.optional(),
  dateOfBirth: DateOfBirthSchema,
  country: CountryCodeSchema,
  acceptedTerms: TermsAcceptanceSchema,
  acceptedConduct: ConductAcceptanceSchema,
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  // Not `PasswordSchema`: an old password that predates a policy change must
  // still be able to sign in and be prompted to rotate.
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Details a social provider cannot give us, collected right after sign-up. */
export const CompleteProfileRequestSchema = z.object({
  username: UsernameSchema,
  displayName: DisplayNameSchema.optional(),
  dateOfBirth: DateOfBirthSchema,
  country: CountryCodeSchema,
  acceptedTerms: TermsAcceptanceSchema,
  acceptedConduct: ConductAcceptanceSchema,
});
export type CompleteProfileRequest = z.infer<typeof CompleteProfileRequestSchema>;

/**
 * Profile edits. Date of birth is absent by design — it is an age attestation,
 * not a preference, so changing it is a support action rather than a form field.
 */
export const UpdateProfileRequestSchema = z
  .object({
    displayName: DisplayNameSchema.nullable().optional(),
    country: CountryCodeSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update.');
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const ChangePasswordRequestSchema = z.object({
  /** Absent when the account was created socially and has no password yet. */
  currentPassword: z.string().min(1).max(200).optional(),
  newPassword: PasswordSchema,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequestSchema>;

export const ForgotPasswordRequestSchema = z.object({ email: EmailSchema });
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordRequestSchema>;

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  newPassword: PasswordSchema,
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;

export const VerifyEmailRequestSchema = z.object({ token: z.string().min(1) });
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const DeleteAccountRequestSchema = z.object({
  /** Required whenever the account has a password, to make deletion deliberate. */
  password: z.string().min(1).max(200).optional(),
});
export type DeleteAccountRequest = z.infer<typeof DeleteAccountRequestSchema>;

/* ------------------------------------------------------------------------- *
 * Session management
 * ------------------------------------------------------------------------- */

/** One signed-in device, as listed on the account's security screen. */
export const AuthSessionSummarySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  expiresAt: z.string(),
  userAgent: z.string().nullable(),
  /** True for the device making the request, which the UI marks and protects. */
  current: z.boolean(),
});
export type AuthSessionSummary = z.infer<typeof AuthSessionSummarySchema>;

export const AuthSessionListResponseSchema = z.object({
  sessions: z.array(AuthSessionSummarySchema),
});
export type AuthSessionListResponse = z.infer<typeof AuthSessionListResponseSchema>;

/* ------------------------------------------------------------------------- *
 * OAuth
 * ------------------------------------------------------------------------- */

/**
 * Where the browser should be sent to begin an authorization-code exchange.
 * Returned as data rather than a 302 so the caller can decide between a
 * redirect and a popup.
 */
export const OAuthStartResponseSchema = z.object({
  authorizationUrl: z.string(),
});
export type OAuthStartResponse = z.infer<typeof OAuthStartResponseSchema>;

/* ------------------------------------------------------------------------- *
 * Passkeys (WebAuthn)
 * ------------------------------------------------------------------------- */

/**
 * The WebAuthn ceremony payloads are passed through to the browser's
 * `navigator.credentials` API and to the server's WebAuthn library verbatim.
 * Both ends already validate them against the specification in far more detail
 * than a hand-written schema could, so the wire contract only asserts that this
 * is a JSON object — restating the spec here would add a second definition to
 * keep in sync and a new way for a valid ceremony to be rejected.
 */
const WebAuthnPayloadSchema = z.record(z.string(), z.unknown());

/** One registered passkey, as listed on the account's security screen. */
export const PasskeySummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  /**
   * False for a passkey that exists on exactly one device. The UI warns about
   * these: losing the device loses the credential.
   */
  backedUp: z.boolean(),
});
export type PasskeySummary = z.infer<typeof PasskeySummarySchema>;

export const PasskeyListResponseSchema = z.object({ passkeys: z.array(PasskeySummarySchema) });
export type PasskeyListResponse = z.infer<typeof PasskeyListResponseSchema>;

export const PasskeyOptionsResponseSchema = z.object({ options: WebAuthnPayloadSchema });
export type PasskeyOptionsResponse = z.infer<typeof PasskeyOptionsResponseSchema>;

export const PasskeyRegistrationRequestSchema = z.object({
  response: WebAuthnPayloadSchema,
  /** Label for the credential, so a list of several is recognizable. */
  name: z.string().trim().min(1).max(60).optional(),
});
export type PasskeyRegistrationRequest = z.infer<typeof PasskeyRegistrationRequestSchema>;

export const PasskeyAuthenticationOptionsRequestSchema = z.object({
  /**
   * Optional. Supplying it narrows the ceremony to that account's credentials;
   * omitting it relies on a discoverable passkey, letting someone sign in
   * without typing anything at all.
   */
  email: EmailSchema.optional(),
});
export type PasskeyAuthenticationOptionsRequest = z.infer<
  typeof PasskeyAuthenticationOptionsRequestSchema
>;

export const PasskeyAuthenticationRequestSchema = z.object({ response: WebAuthnPayloadSchema });
export type PasskeyAuthenticationRequest = z.infer<typeof PasskeyAuthenticationRequestSchema>;

export const RenamePasskeyRequestSchema = z.object({ name: z.string().trim().min(1).max(60) });
export type RenamePasskeyRequest = z.infer<typeof RenamePasskeyRequestSchema>;

/* ------------------------------------------------------------------------- *
 * Capabilities
 * ------------------------------------------------------------------------- */

/**
 * What this deployment can actually do. The sign-in screen renders from this
 * rather than from build-time constants, so a provider whose credentials are
 * not configured is never offered as a button that cannot work.
 */
export const AuthCapabilitiesResponseSchema = z.object({
  oauthProviders: z.array(OAuthProviderSchema),
  /** False when the deployment cannot deliver mail, which disables reset flows. */
  emailDelivery: z.boolean(),
});
export type AuthCapabilitiesResponse = z.infer<typeof AuthCapabilitiesResponseSchema>;

/** Generic acknowledgement for routes whose only answer is "it worked". */
export const OkResponseSchema = z.object({ ok: z.literal(true) });
export type OkResponse = z.infer<typeof OkResponseSchema>;
