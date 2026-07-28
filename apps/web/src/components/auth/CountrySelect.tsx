'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { UN_COUNTRY_CODES, isCountryCode, type CountryCode } from '@cougny/protocol';

interface CountrySelectProps {
  id: string;
  /** `''` is the unselected state; anything else is a real country code. */
  value: CountryCode | '';
  onChange: (code: CountryCode) => void;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Every UN-recognized country: the 193 member states plus the Holy See and
 * Palestine.
 *
 * Names are not stored anywhere — they come from `Intl.DisplayNames` in the
 * active locale, so the list is translated by the platform rather than by a
 * message file with 195 entries per language, and it stays current as the
 * browser's data updates. Sorting uses a locale-aware collator, because
 * alphabetical order is itself language-specific.
 */
export function CountrySelect({
  id,
  value,
  onChange,
  required,
  disabled,
}: CountrySelectProps): React.ReactElement {
  const locale = useLocale();
  const t = useTranslations('account');

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: 'region' });
    const collator = new Intl.Collator(locale);

    return UN_COUNTRY_CODES.map((code) => ({
      code,
      // `of` falls back to the code itself for a region the runtime does not
      // know, so an unfamiliar entry degrades to "PS" rather than disappearing.
      name: names.of(code) ?? code,
    })).sort((a, b) => collator.compare(a.name, b.name));
  }, [locale]);

  return (
    <select
      id={id}
      name="country"
      value={value}
      required={required}
      disabled={disabled}
      onChange={(event) => {
        // Every option comes from the same list, so this always narrows; the
        // guard is what lets the callback promise a real `CountryCode`.
        if (isCountryCode(event.target.value)) onChange(event.target.value);
      }}
      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 transition focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/40 disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
    >
      <option value="" disabled>
        {t('countryPlaceholder')}
      </option>
      {countries.map(({ code, name }) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </select>
  );
}
