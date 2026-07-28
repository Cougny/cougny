import { createTransport, type Transporter } from 'nodemailer';
import type { FastifyBaseLogger } from 'fastify';
import { env } from '../env.js';
import { translate } from '../i18n/index.js';

/**
 * Transactional mail for account flows.
 *
 * With `SMTP_URL` unset — the default for local development — messages are
 * written to the log instead of sent, so verification and reset links are still
 * reachable without standing up a mail server. Nothing else in the auth code
 * has to know which mode is active.
 */
let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter === undefined) {
    transporter = env.SMTP_URL ? createTransport(env.SMTP_URL) : null;
  }
  return transporter;
}

/** True when mail actually leaves the process. Reported by the readiness probe. */
export function isMailConfigured(): boolean {
  return getTransporter() !== null;
}

interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends a message, or logs it when no transport is configured.
 *
 * Never throws. A delivery failure must not turn a successful registration into
 * a 500 the user reads as "try again" — retrying would then fail on a duplicate
 * email. Callers that need the user to act on the mail say so in their response
 * copy and offer a resend instead.
 */
async function send(message: MailMessage, log: FastifyBaseLogger): Promise<void> {
  const transport = getTransporter();

  if (!transport) {
    log.info({ to: message.to, subject: message.subject, body: message.text }, 'outgoing mail');
    return;
  }

  try {
    await transport.sendMail({ from: env.MAIL_FROM, ...message });
  } catch (error) {
    log.error({ err: error, to: message.to }, 'failed to send mail');
  }
}

/**
 * Builds a link into the web app. The base is server configuration, never
 * anything a caller supplied, so these links cannot be pointed elsewhere.
 */
function webAppLink(path: string, token: string): string {
  const url = new URL(path, env.WEB_APP_URL);
  url.searchParams.set('token', token);
  return url.toString();
}

export async function sendEmailVerification(
  to: string,
  token: string,
  hours: number,
  log: FastifyBaseLogger,
  locale?: string,
): Promise<void> {
  await send(
    {
      to,
      subject: translate('mail.verifyEmail.subject', {}, locale),
      text: translate(
        'mail.verifyEmail.body',
        { link: webAppLink('/verify-email', token), hours },
        locale,
      ),
    },
    log,
  );
}

export async function sendPasswordReset(
  to: string,
  token: string,
  hours: number,
  log: FastifyBaseLogger,
  locale?: string,
): Promise<void> {
  await send(
    {
      to,
      subject: translate('mail.resetPassword.subject', {}, locale),
      text: translate(
        'mail.resetPassword.body',
        { link: webAppLink('/reset-password', token), hours },
        locale,
      ),
    },
    log,
  );
}
