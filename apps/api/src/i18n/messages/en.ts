/**
 * English message catalog for server-generated user-facing text.
 *
 * Everything the API sends to a person — transactional mail, for now — lives
 * here rather than inline in the code, so a new locale is a new file beside
 * this one. `{placeholders}` are substituted at render time.
 */
export const en = {
  'mail.verifyEmail.subject': 'Confirm your Cougny email address',
  'mail.verifyEmail.body':
    'Confirm your email address to finish setting up your Cougny account:\n\n{link}\n\nThis link expires in {hours} hours. If you did not create an account, you can ignore this message.',

  'mail.resetPassword.subject': 'Reset your Cougny password',
  'mail.resetPassword.body':
    'Use this link to choose a new Cougny password:\n\n{link}\n\nThis link expires in {hours} hour and can be used once. If you did not ask for a password reset, you can ignore this message — your password has not changed.',
} as const;

/** Every key the catalog defines. A new locale must cover all of them. */
export type MessageKey = keyof typeof en;
