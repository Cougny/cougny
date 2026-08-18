'use client';

interface SectionProps {
  /**
   * Position in the page's running order, rendered as `01`, `02`, … in the
   * display face — the same device the landing page's "how it works" list
   * uses. At this size the numeral is a graphic element rather than a label,
   * and it is what makes a column of settings read as one composed page
   * instead of six unrelated forms.
   */
  index: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * A titled block on the account page.
 *
 * Deliberately un-boxed, to match the rest of the site: a rounded card per
 * section stacked six deep is the look the landing page was rebuilt to get
 * away from, and settings are the place it reads worst — every panel the same
 * size and weight, so nothing has a hierarchy. What replaces it is a rule
 * between rows and a heading column beside the controls, which separates the
 * sections just as firmly and lets the eye skip down the headings to find the
 * one it wants.
 */
export function Section({ index, title, description, children }: SectionProps): React.ReactElement {
  return (
    <section className="border-b border-neutral-200/80 last:border-b-0 dark:border-white/10">
      <div className="grid gap-x-10 gap-y-6 py-10 sm:py-12 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
        <div>
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl leading-none text-brand dark:text-violet-300">
              {String(index).padStart(2, '0')}
            </span>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-900 dark:text-white">
              {title}
            </h2>
          </div>
          {description && (
            <p className="pt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
              {description}
            </p>
          )}
        </div>
        <div className="max-w-xl">{children}</div>
      </div>
    </section>
  );
}

/**
 * The tone a button carries, which is a statement about consequence rather
 * than about colour:
 *
 * - `primary` — the one action a section exists for. Ink on paper, inverted
 *   per theme, the same treatment the sign-in card's submit button gets.
 * - `neutral` — everything else. Outlined, so it never competes with primary.
 * - `danger` — undoes something (unlink, sign out a device, remove a passkey).
 *   Outlined too: these sit in lists, and a column of solid red reads as an
 *   alarm rather than as a row of ordinary controls.
 * - `destructive` — the one irreversible confirmation on the page. Solid red,
 *   used exactly once, which is what keeps it meaning anything.
 */
type ButtonTone = 'primary' | 'neutral' | 'danger' | 'destructive';

const TONE_CLASS: Record<ButtonTone, string> = {
  primary:
    'border-transparent bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200',
  neutral:
    'border-neutral-300 text-neutral-700 hover:border-neutral-400 hover:bg-neutral-900/[0.04] dark:border-white/15 dark:text-neutral-200 dark:hover:border-white/25 dark:hover:bg-white/[0.06]',
  danger:
    'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/70 dark:text-red-400 dark:hover:bg-red-950/40',
  destructive: 'border-transparent bg-red-600 text-white hover:bg-red-500',
};

/** A button inside a section. Pill-shaped, to match the rest of the site. */
export function SecondaryButton({
  children,
  onClick,
  disabled,
  tone = 'neutral',
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: ButtonTone;
  type?: 'button' | 'submit';
}): React.ReactElement {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap rounded-full border px-5 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${TONE_CLASS[tone]}`}
    >
      {children}
    </button>
  );
}

/**
 * The label/value pairs at the top of the profile section — fields shown but
 * not edited. Small caps label over the value, so a read-only row is visibly
 * a different kind of thing from an input.
 */
export function ReadOnlyField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-neutral-400 dark:text-neutral-500">
        {label}
      </p>
      <div className="pt-1.5 text-sm text-neutral-900 dark:text-neutral-100">{children}</div>
    </div>
  );
}

/** Status pill — verification state, "this device", and the like. */
export function Pill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'positive' | 'warning' | 'neutral';
}): React.ReactElement {
  const toneClass =
    tone === 'positive'
      ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/25'
      : tone === 'warning'
        ? 'bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:text-amber-300 dark:ring-amber-400/25'
        : 'bg-neutral-900/[0.06] text-neutral-600 ring-neutral-900/10 dark:bg-white/10 dark:text-neutral-300 dark:ring-white/15';

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClass}`}
    >
      {children}
    </span>
  );
}

/**
 * A row in one of the page's lists (passkeys, linked accounts, devices).
 *
 * Hairline-separated rather than carded, and padded enough that its action
 * button has room to sit on the same line without crowding the label.
 */
export function ListRow({
  icon,
  children,
  action,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}): React.ReactElement {
  return (
    <li className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        {icon}
        <div className="min-w-0">{children}</div>
      </div>
      {action}
    </li>
  );
}

/** The hairline-divided list those rows sit in. */
export function List({ children }: { children: React.ReactNode }): React.ReactElement {
  return <ul className="divide-y divide-neutral-200/80 dark:divide-white/10">{children}</ul>;
}
