'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AuthBackdrop } from '@/components/auth/AuthBackdrop';

interface AuthShellProps {
  title: string;
  /** One line under the title. Omitted where the title says enough on its own. */
  subtitle?: string;
  children: React.ReactNode;
  /** Cross-link strip pinned to the bottom of the card. */
  footer?: React.ReactNode;
}

/**
 * The frame every account screen sits in: one floating card over a blurred
 * view of the app.
 *
 * The account screens are the door to the product rather than a place inside
 * it, so they drop the site header — its account menu and tagline have nothing
 * to say to someone who has not signed in yet. What the card keeps is the
 * wordmark, as a way home, and the theme toggle, the one control that still
 * applies here.
 *
 * The card is centred but not fixed: a long form (sign-up carries five fields
 * and two attestations) scrolls the page while the backdrop stays put, which
 * keeps the whole form reachable on a short viewport without nesting a
 * scroll region inside a dialog.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps): React.ReactElement {
  const t = useTranslations('app');

  return (
    <div className="relative min-h-dvh">
      <AuthBackdrop />

      <div className="relative flex min-h-dvh items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
        <section className="relative w-full max-w-md motion-safe:animate-auth-card">
          <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-2xl shadow-neutral-900/25 backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/60">
            {/* Hairline along the top edge, the way light catches real glass. */}
            <span
              aria-hidden
              className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/30"
            />

            <div className="px-8 py-9 sm:px-10 sm:py-11">
              <Link href="/" className="inline-flex">
                {/* The wordmark in the brand face, plain black on white and
                    white on black — the mark carries the identity here, so
                    colour on top of it is one thing too many. */}
                <span className="font-display text-3xl uppercase leading-none tracking-wide text-neutral-900 dark:text-white">
                  {t('name')}
                </span>
              </Link>

              <h1 className="pt-7 text-[1.375rem] font-semibold leading-snug tracking-tight text-neutral-900 dark:text-white">
                {title}
              </h1>
              {subtitle && (
                <p className="pt-1.5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                  {subtitle}
                </p>
              )}

              <div className="pt-8">{children}</div>
            </div>

            {footer && (
              <div className="border-t border-neutral-200/60 bg-neutral-50/50 px-8 py-4 text-center text-sm text-neutral-500 sm:px-10 dark:border-white/[0.08] dark:bg-white/[0.02] dark:text-neutral-400">
                {footer}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Rule between the two halves of a sign-in choice — providers and a password. */
export function AuthDivider({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-3 py-6">
      <span className="h-px flex-1 bg-neutral-300/70 dark:bg-white/10" />
      <span className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        {label}
      </span>
      <span className="h-px flex-1 bg-neutral-300/70 dark:bg-white/10" />
    </div>
  );
}
