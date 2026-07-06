import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SiteHeader } from '@/components/SiteHeader';

const SECTION_KEYS = [
  'acceptance',
  'eligibility',
  'conduct',
  'privacy',
  'moderation',
  'liability',
  'changes',
] as const;

export default function TermsPage(): React.ReactElement {
  const t = useTranslations('terms');

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          {t('title')}
        </h1>
        <p className="pt-3 text-sm text-neutral-400 dark:text-neutral-500">{t('updated')}</p>

        <div className="space-y-10 pt-12">
          {SECTION_KEYS.map((key) => (
            <section key={key}>
              <h2 className="pb-2 text-lg font-semibold text-neutral-800 dark:text-neutral-200">
                {t(`${key}Title`)}
              </h2>
              <p className="leading-relaxed text-neutral-500 dark:text-neutral-400">
                {t(`${key}Body`)}
              </p>
            </section>
          ))}
        </div>

        <Link
          href="/"
          className="mt-14 inline-block rounded-full border border-neutral-200 bg-white px-6 py-2.5 text-sm font-medium text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:text-neutral-800 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700 dark:hover:text-neutral-200"
        >
          {t('back')}
        </Link>
      </main>
    </div>
  );
}
