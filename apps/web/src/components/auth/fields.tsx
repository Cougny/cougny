'use client';

/**
 * Shared form primitives for the account screens, so every field carries the
 * same label association, focus ring, and error styling rather than repeating
 * a long class string per input.
 */

const INPUT_CLASS =
  'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 transition placeholder:text-neutral-400 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-500';

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
      >
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>): React.ReactElement {
  return <input {...props} className={INPUT_CLASS} />;
}

/** A full-width primary action, with a disabled state for pending submits. */
export function SubmitButton({
  children,
  disabled,
  pending,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  pending?: boolean;
}): React.ReactElement {
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-fg transition hover:bg-brand-strong active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Inline error, announced to assistive technology when it appears. */
export function FormError({ message }: { message: string | null }): React.ReactElement | null {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
    >
      {message}
    </p>
  );
}

/** Inline confirmation, for flows that finish without navigating away. */
export function FormSuccess({ message }: { message: string | null }): React.ReactElement | null {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
    >
      {message}
    </p>
  );
}
