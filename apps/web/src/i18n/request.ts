import { getRequestConfig } from 'next-intl/server';

/**
 * next-intl request configuration. The MVP ships a single locale, but all
 * user-facing copy lives in `messages/*.json` (never hardcoded in components),
 * so adding locales later is only a matter of adding message files and a
 * locale negotiation step here.
 */
const DEFAULT_LOCALE = 'en';

export default getRequestConfig(async () => {
  const locale = DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
