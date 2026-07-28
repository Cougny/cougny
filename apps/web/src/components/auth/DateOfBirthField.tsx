'use client';

import { useMemo } from 'react';
import { MINIMUM_AGE_YEARS } from '@cougny/protocol';

interface DateOfBirthFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Date of birth, used to enforce the 18+ requirement.
 *
 * The `max` attribute stops the browser from even offering a date that fails
 * the age check, which is a kinder way to communicate the rule than a rejection
 * after submitting. It is a convenience, not the enforcement — the server
 * re-checks every date it is given, using the same shared helper this file
 * imports, so the two can never disagree.
 */
export function DateOfBirthField({
  id,
  value,
  onChange,
  disabled,
}: DateOfBirthFieldProps): React.ReactElement {
  /** The most recent date of birth that still clears the age bar. */
  const latestAllowed = useMemo(() => {
    const date = new Date();
    date.setUTCFullYear(date.getUTCFullYear() - MINIMUM_AGE_YEARS);
    return date.toISOString().slice(0, 10);
  }, []);

  return (
    <input
      id={id}
      name="dateOfBirth"
      type="date"
      required
      value={value}
      max={latestAllowed}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 transition focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
    />
  );
}
