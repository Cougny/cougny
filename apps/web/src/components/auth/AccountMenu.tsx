'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserIcon } from '@/components/icons';

/**
 * Sign-in link, or the signed-in account's menu.
 *
 * Renders nothing at all while the initial refresh is in flight — showing
 * "Sign in" and then swapping it for an avatar a moment later reads as a bug to
 * someone who is already signed in.
 */
export function AccountMenu(): React.ReactElement | null {
  const t = useTranslations('account');
  const router = useRouter();
  const { status, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape, the two ways people expect to dismiss
  // a menu they opened by accident.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent): void => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (status === 'loading') return null;

  if (status === 'anonymous' || !user) {
    return (
      <Link
        href="/login"
        className="rounded-full px-4 py-1.5 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        {t('signIn')}
      </Link>
    );
  }

  const label = user.displayName ?? user.username ?? t('title');

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-brand-fg">
          <UserIcon className="h-4 w-4" />
        </span>
        <span className="hidden max-w-32 truncate sm:inline">{label}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        >
          {!user.profileComplete && (
            <Link
              href="/signup/complete"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-neutral-50 dark:text-amber-400 dark:hover:bg-neutral-800"
            >
              {t('finishSetup')}
            </Link>
          )}
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {t('title')}
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut().then(() => router.push('/'));
            }}
            className="block w-full px-4 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {t('signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
