import { en, type MessageKey } from './messages/en.js';

/**
 * Minimal server-side internationalization for the text the API sends to
 * people (transactional mail). The web client has next-intl; this exists so the
 * API's own copy is equally translatable rather than hardcoded at the call site.
 *
 * Adding a locale means adding a catalog beside `messages/en.ts` and listing it
 * here — the `MessageKey` type makes an incomplete catalog a compile error.
 */
const CATALOGS: Record<string, Record<MessageKey, string>> = { en };

const DEFAULT_LOCALE = 'en';

/**
 * Picks the best catalog for a locale tag, narrowing `en-GB` to `en` before
 * giving up. Falls back to the default rather than failing: mail that is in the
 * wrong language still beats mail that never sends.
 */
function catalogFor(locale: string | undefined): Record<MessageKey, string> {
  if (!locale) return CATALOGS[DEFAULT_LOCALE] as Record<MessageKey, string>;
  const base = locale.toLowerCase().split('-')[0] ?? DEFAULT_LOCALE;
  return (
    CATALOGS[locale.toLowerCase()] ??
    CATALOGS[base] ??
    (CATALOGS[DEFAULT_LOCALE] as Record<MessageKey, string>)
  );
}

/** Resolves a message and substitutes `{placeholder}` values. */
export function translate(
  key: MessageKey,
  values: Record<string, string | number> = {},
  locale: string = DEFAULT_LOCALE,
): string {
  const template = catalogFor(locale)[key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/**
 * Reads the caller's preferred language from an `Accept-Language` header. Only
 * the top choice is honoured; the catalog lookup handles the rest.
 */
export function localeFromHeader(header: string | undefined): string {
  return header?.split(',')[0]?.trim().slice(0, 10) || DEFAULT_LOCALE;
}
