'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from '@/components/ThemeToggle';
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
          {/* Halo: lifts the card off the backdrop without a hard drop shadow. */}
          <div
            aria-hidden
            className="absolute -inset-5 rounded-[2.75rem] bg-gradient-to-br from-brand/20 via-brand-accent/10 to-transparent blur-2xl"
          />

          <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-2xl shadow-neutral-900/25 backdrop-blur-2xl dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/60">
            {/* Hairline along the top edge, the way light catches real glass. */}
            <span
              aria-hidden
              className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/30"
            />

            <div className="px-7 py-8 sm:px-9 sm:py-10">
              <div className="flex items-center justify-between">
                <Link href="/" className="inline-flex">
                  <span className="bg-gradient-to-br from-brand to-brand-accent bg-clip-text text-lg font-extrabold tracking-tight text-transparent">
                    {t('name')}
                  </span>
                </Link>
                {/* Placed in the card rather than floating over it: this form
                    scrolls, and nothing should hover across it. */}
                <ThemeToggle className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-900/5 hover:text-neutral-800 active:scale-95 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100" />
              </div>

              <h1 className="pt-5 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
                {title}
              </h1>
              {subtitle && (
                <p className="pt-2 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p>
              )}

              <div className="pt-7">{children}</div>
            </div>

            {footer && (
              <div className="border-t border-neutral-200/70 bg-white/40 px-7 py-4 text-center text-sm text-neutral-500 sm:px-9 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-400">
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
