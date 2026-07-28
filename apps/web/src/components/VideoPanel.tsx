/**
 * One tile of the call stage — a self view or a partner view.
 *
 * Extracted from the home screen so the sign-in backdrop can build the real
 * stage rather than an imitation of it: what sits behind the account card is
 * the same component the app renders once you are through it.
 */
export function VideoPanel({
  label,
  live = false,
  children,
}: {
  label: string;
  live?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="relative flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      {children}

      {/* Label chip at bottom-left. */}
      <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-neutral-950/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
        {label}
      </span>
    </div>
  );
}
