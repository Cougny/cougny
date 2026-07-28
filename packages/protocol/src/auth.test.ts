import { describe, expect, it } from 'vitest';
import {
  CountryCodeSchema,
  DateOfBirthSchema,
  MINIMUM_AGE_YEARS,
  RegisterRequestSchema,
  UN_COUNTRY_CODES,
  calculateAge,
  isAtLeastMinimumAge,
  isCountryCode,
  parseCalendarDate,
} from './index.js';

/** Fixed "now" so the age cases do not drift as real time passes. */
const NOW = new Date('2026-07-28T12:00:00.000Z');

describe('parseCalendarDate', () => {
  it('parses a real date at UTC midnight', () => {
    expect(parseCalendarDate('2001-02-28')?.toISOString()).toBe('2001-02-28T00:00:00.000Z');
  });

  it('rejects a date that does not exist rather than rolling it over', () => {
    // `Date.UTC(2001, 1, 30)` silently becomes March 2 — the exact bug the
    // round-trip check exists to catch.
    expect(parseCalendarDate('2001-02-30')).toBeNull();
  });

  it('accepts February 29 only in a leap year', () => {
    expect(parseCalendarDate('2024-02-29')).not.toBeNull();
    expect(parseCalendarDate('2023-02-29')).toBeNull();
  });

  it('rejects malformed input', () => {
    for (const value of ['2001-2-28', '20010228', 'yesterday', '', '2001-02-28T00:00:00Z']) {
      expect(parseCalendarDate(value)).toBeNull();
    }
  });
});

describe('calculateAge', () => {
  it('counts whole years', () => {
    expect(calculateAge(new Date('2000-01-01T00:00:00Z'), NOW)).toBe(26);
  });

  it('does not count a birthday that has not happened yet this year', () => {
    // Tomorrow's birthday: still 25 today.
    expect(calculateAge(new Date('2000-07-29T00:00:00Z'), NOW)).toBe(25);
  });

  it('counts the birthday itself', () => {
    expect(calculateAge(new Date('2000-07-28T00:00:00Z'), NOW)).toBe(26);
  });
});

describe('isAtLeastMinimumAge', () => {
  it('accepts someone who turned 18 today', () => {
    expect(isAtLeastMinimumAge('2008-07-28', NOW)).toBe(true);
  });

  it('rejects someone who turns 18 tomorrow', () => {
    expect(isAtLeastMinimumAge('2008-07-29', NOW)).toBe(false);
  });

  it('rejects a date of birth in the future', () => {
    expect(isAtLeastMinimumAge('2030-01-01', NOW)).toBe(false);
  });

  it('rejects an impossible date', () => {
    expect(isAtLeastMinimumAge('1990-02-31', NOW)).toBe(false);
  });

  it(`uses ${MINIMUM_AGE_YEARS} as the threshold`, () => {
    const justUnder = new Date(NOW);
    justUnder.setUTCFullYear(NOW.getUTCFullYear() - MINIMUM_AGE_YEARS);
    justUnder.setUTCDate(justUnder.getUTCDate() + 1);
    expect(isAtLeastMinimumAge(justUnder.toISOString().slice(0, 10), NOW)).toBe(false);
  });
});

describe('DateOfBirthSchema', () => {
  it('rejects an under-18 date of birth', () => {
    const thisYear = new Date().getUTCFullYear();
    expect(DateOfBirthSchema.safeParse(`${thisYear - 10}-01-01`).success).toBe(false);
  });

  it('accepts a clearly adult date of birth', () => {
    expect(DateOfBirthSchema.safeParse('1990-06-15').success).toBe(true);
  });
});

describe('countries', () => {
  it('covers the 193 UN member states plus the 2 observer states', () => {
    expect(UN_COUNTRY_CODES).toHaveLength(195);
  });

  it('has no duplicates', () => {
    expect(new Set(UN_COUNTRY_CODES).size).toBe(UN_COUNTRY_CODES.length);
  });

  it('is entirely well-formed alpha-2 codes', () => {
    for (const code of UN_COUNTRY_CODES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it('includes the two non-member observer states', () => {
    expect(isCountryCode('VA')).toBe(true);
    expect(isCountryCode('PS')).toBe(true);
  });

  it('excludes territories and non-UN entities', () => {
    // Codes that are valid ISO 3166-1 but not UN-recognized countries.
    for (const code of ['TW', 'HK', 'PR', 'XK', 'GL']) {
      expect(isCountryCode(code)).toBe(false);
    }
  });

  it('accepts a lowercase code by normalizing it', () => {
    expect(CountryCodeSchema.parse('de')).toBe('DE');
  });

  it('rejects a code that is not a country', () => {
    expect(CountryCodeSchema.safeParse('ZZ').success).toBe(false);
  });
});

describe('RegisterRequestSchema', () => {
  const valid = {
    email: 'Ada@Example.COM',
    password: 'correct horse battery staple',
    username: 'Ada_Lovelace',
    dateOfBirth: '1990-06-15',
    country: 'gb',
    acceptedTerms: true,
    acceptedConduct: true,
  };

  it('normalizes email, username, and country', () => {
    const parsed = RegisterRequestSchema.parse(valid);
    expect(parsed.email).toBe('ada@example.com');
    expect(parsed.username).toBe('ada_lovelace');
    expect(parsed.country).toBe('GB');
  });

  it('requires terms to be accepted, not merely present', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, acceptedTerms: false }).success).toBe(false);
    const { acceptedTerms: _omitted, ...withoutTerms } = valid;
    expect(RegisterRequestSchema.safeParse(withoutTerms).success).toBe(false);
  });

  it('requires the content rules to be agreed to separately', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, acceptedConduct: false }).success).toBe(
      false,
    );
    const { acceptedConduct: _omitted, ...withoutConduct } = valid;
    expect(RegisterRequestSchema.safeParse(withoutConduct).success).toBe(false);
  });

  it('rejects a short password', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
  });

  it('rejects a username with punctuation', () => {
    expect(RegisterRequestSchema.safeParse({ ...valid, username: 'ada.lovelace' }).success).toBe(
      false,
    );
  });

  it('rejects an under-age registration', () => {
    const thisYear = new Date().getUTCFullYear();
    expect(
      RegisterRequestSchema.safeParse({ ...valid, dateOfBirth: `${thisYear - 12}-01-01` }).success,
    ).toBe(false);
  });
});
